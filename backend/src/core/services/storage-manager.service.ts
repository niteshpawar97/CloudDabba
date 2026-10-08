import fs from 'fs/promises';
import docker from '../../infrastructure/docker/docker-client';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { DeployLockService } from './deploy-lock.service';

/**
 * Automatic Docker storage management.
 *
 * Safety invariants (enforced here, not by the caller):
 *  - Only build cache and *unused images* are ever removed. Volumes, networks
 *    and containers are never pruned, so MySQL/MariaDB/PostgreSQL/Redis data
 *    (which live in volumes) cannot be touched.
 *  - Any image referenced by ANY container (running or stopped), or by a
 *    LIVE/in-flight deployment, is protected. Database/cache base images are
 *    protected by name.
 *  - Nothing runs while a deployment/build is active (DeployLockService).
 */

export type CleanupLevel = 'WARNING' | 'CLEANUP' | 'EMERGENCY' | 'SAFE';
export type CleanupTrigger = 'AUTO' | 'MANUAL';

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const storageConfig = {
  enabled: process.env.STORAGE_AUTO_CLEANUP !== 'false',
  warnPct: num(process.env.STORAGE_WARN_PCT, 80),
  cleanupPct: num(process.env.STORAGE_CLEANUP_PCT, 90),
  emergencyPct: num(process.env.STORAGE_EMERGENCY_PCT, 95),
  checkIntervalMs: num(process.env.STORAGE_CHECK_INTERVAL_MIN, 10) * 60 * 1000,
};

const HOUR = 60 * 60 * 1000;
const GRACE_NORMAL_MS = HOUR;
const GRACE_AGGRESSIVE_MS = 10 * 60 * 1000;
const CACHE_MAX_AGE_NORMAL = '24h';
const WARNING_LOG_EVERY_MS = 6 * HOUR;
const SKIP_LOG_EVERY_MS = HOUR;

// Images that back stateful services — never auto-removed even if momentarily unused.
const PROTECTED_REPO = /(^|\/)(postgres|postgis|mysql|mariadb|redis|mongo|valkey)$/i;

export interface DiskUsage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  path: string;
}

export interface CleanupResult {
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  level: CleanupLevel;
  usageBefore: number;
  usageAfter: number | null;
  bytesReclaimed: number;
  imagesRemoved: number;
  details: string;
}

const isDangling = (img: any) =>
  !img.RepoTags || img.RepoTags.length === 0 || img.RepoTags.every((t: string) => t === '<none>:<none>');

const uniqueSize = (img: any) => Math.max(0, (img.Size || 0) - Math.max(0, img.SharedSize || 0));

export class StorageManagerService {
  private static timer: NodeJS.Timeout | null = null;
  private static lastWarnLog = 0;
  private static lastSkipLog = 0;

  // ---------- Disk / Docker inspection ----------

  static async getDiskUsage(): Promise<DiskUsage> {
    const candidates: string[] = [];
    try {
      const info: any = await docker.info();
      if (info?.DockerRootDir) candidates.push(info.DockerRootDir);
    } catch { /* fall through */ }
    candidates.push(process.platform === 'win32' ? process.cwd() : '/');

    let lastErr: any;
    for (const p of candidates) {
      try {
        const s: any = await (fs as any).statfs(p);
        const totalBytes = s.blocks * s.bsize;
        const freeBytes = s.bavail * s.bsize;
        const usedBytes = totalBytes - s.bfree * s.bsize;
        // Same definition as `df`: used / (used + available to unprivileged users)
        const denom = usedBytes + freeBytes;
        const usedPercent = denom > 0 ? Math.round((usedBytes / denom) * 1000) / 10 : 0;
        return { totalBytes, usedBytes, freeBytes, usedPercent, path: p };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Unable to read disk usage');
  }

  /** Image IDs that must never be removed. */
  private static async protectedImageIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    const containers = await docker.listContainers({ all: true });
    for (const c of containers as any[]) if (c.ImageID) ids.add(c.ImageID);
    const live = await prisma.deployment.findMany({
      where: {
        status: { in: ['LIVE', 'QUEUED', 'CLONING', 'BUILDING', 'DEPLOYING'] as any },
        dockerImageId: { not: null },
      },
      select: { dockerImageId: true },
    });
    for (const d of live) if (d.dockerImageId) ids.add(d.dockerImageId);
    return ids;
  }

  private static isProtectedByName(img: any): boolean {
    return (img.RepoTags || []).some((t: string) => PROTECTED_REPO.test(t.split(':')[0]));
  }

  /** Unused, non-protected images older than graceMs. */
  private static async candidateImages(opts: { graceMs: number; onlyOurs: boolean }) {
    const [images, protectedIds] = await Promise.all([docker.listImages(), this.protectedImageIds()]);
    const cutoff = Date.now() / 1000 - opts.graceMs / 1000;
    return (images as any[]).filter((img) => {
      if (protectedIds.has(img.Id)) return false;
      if (img.Created > cutoff) return false;
      if (this.isProtectedByName(img)) return false;
      if (opts.onlyOurs) {
        const ours = (img.RepoTags || []).some((t: string) => t.startsWith('clouddabba/'));
        return ours || isDangling(img);
      }
      return true;
    });
  }

  static async getStatus() {
    const [disk, df, aggressive, busy] = await Promise.all([
      this.getDiskUsage(),
      (docker as any).df(),
      this.candidateImages({ graceMs: GRACE_AGGRESSIVE_MS, onlyOurs: false }).catch(() => [] as any[]),
      DeployLockService.busyReason(),
    ]);

    const images: any[] = df?.Images || [];
    const cache: any[] = df?.BuildCache || [];
    const volumes: any[] = df?.Volumes || [];
    const containers: any[] = df?.Containers || [];

    const reclaimableImages = aggressive.reduce((n, i) => n + uniqueSize(i), 0);
    const reclaimableCache = cache.filter((c) => !c.InUse).reduce((n, c) => n + (c.Size || 0), 0);

    const last = await prisma.storageCleanupLog.findFirst({ orderBy: { createdAt: 'desc' } });

    return {
      disk,
      level: this.levelFor(disk.usedPercent),
      thresholds: { warning: storageConfig.warnPct, cleanup: storageConfig.cleanupPct, emergency: storageConfig.emergencyPct },
      autoCleanupEnabled: storageConfig.enabled,
      docker: {
        images: {
          count: images.length,
          totalBytes: df?.LayersSize || images.reduce((n, i) => n + (i.Size || 0), 0),
          unusedCount: aggressive.length,
          reclaimableBytes: reclaimableImages,
        },
        buildCache: {
          count: cache.length,
          totalBytes: cache.reduce((n, c) => n + (c.Size || 0), 0),
          reclaimableBytes: reclaimableCache,
        },
        containers: { count: containers.length },
        // Reported for visibility only — volumes are never cleaned automatically.
        volumes: {
          count: volumes.length,
          sizeBytes: volumes.reduce((n, v) => n + Math.max(0, v.UsageData?.Size ?? 0), 0),
          protected: true,
        },
      },
      reclaimableBytes: reclaimableImages + reclaimableCache,
      busy: busy || (DeployLockService.isCleaning() ? 'cleanup in progress' : null),
      lastCleanup: last ? { ...last, bytesReclaimed: Number(last.bytesReclaimed) } : null,
    };
  }

  static levelFor(pct: number): 'OK' | 'WARNING' | 'CLEANUP' | 'EMERGENCY' {
    if (pct >= storageConfig.emergencyPct) return 'EMERGENCY';
    if (pct >= storageConfig.cleanupPct) return 'CLEANUP';
    if (pct >= storageConfig.warnPct) return 'WARNING';
    return 'OK';
  }

  static async getHistory(limit = 50) {
    const rows = await prisma.storageCleanupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({ ...r, bytesReclaimed: Number(r.bytesReclaimed) }));
  }

  // ---------- Cleanup ----------

  /** POST /build/prune — removes only cache records not currently in use. */
  private static async pruneBuildCache(all: boolean, olderThan?: string): Promise<number> {
    const filters = olderThan ? JSON.stringify({ until: [olderThan] }) : '';
    const qs = `all=${all}${filters ? `&filters=${encodeURIComponent(filters)}` : ''}`;
    const res: any = await new Promise((resolve, reject) => {
      (docker as any).modem.dial(
        { path: `/build/prune?${qs}`, method: 'POST', statusCodes: { 200: true, 500: 'server error' } },
        (err: any, data: any) => (err ? reject(err) : resolve(data)),
      );
    });
    return res?.SpaceReclaimed || 0;
  }

  private static async removeImages(images: any[]): Promise<{ removed: number; bytes: number }> {
    let removed = 0;
    let bytes = 0;
    for (const img of images) {
      try {
        // No force: Docker itself refuses to delete an image a container still uses.
        await docker.getImage(img.Id).remove({ force: false });
        removed++;
        bytes += uniqueSize(img);
      } catch (err: any) {
        // 404 gone, 409 in use / has dependent children — both fine to skip.
        if (err.statusCode !== 404 && err.statusCode !== 409) {
          logger.warn(`Storage cleanup: could not remove image ${img.Id}: ${err.message}`);
        }
      }
    }
    return { removed, bytes };
  }

  private static async record(trigger: CleanupTrigger, r: CleanupResult) {
    try {
      await prisma.storageCleanupLog.create({
        data: {
          trigger,
          level: r.level,
          status: r.status,
          usageBefore: r.usageBefore,
          usageAfter: r.usageAfter,
          bytesReclaimed: BigInt(Math.round(r.bytesReclaimed)),
          imagesRemoved: r.imagesRemoved,
          details: r.details.slice(0, 2000),
        },
      });
      // Keep the history table bounded.
      const old = await prisma.storageCleanupLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 500,
        select: { id: true },
      });
      if (old.length) await prisma.storageCleanupLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    } catch (e: any) {
      logger.error(`Storage cleanup: failed to write history: ${e.message}`);
    }
  }

  /** Core executor. Never throws. Honors the deploy/build lock. */
  static async runCleanup(level: Exclude<CleanupLevel, 'WARNING'>, trigger: CleanupTrigger): Promise<CleanupResult> {
    let usageBefore = 0;
    try { usageBefore = (await this.getDiskUsage()).usedPercent; } catch { /* reported via details */ }

    const lock = await DeployLockService.tryBeginCleanup();
    if ('reason' in lock) {
      const r: CleanupResult = {
        status: 'SKIPPED', level, usageBefore, usageAfter: null, bytesReclaimed: 0, imagesRemoved: 0,
        details: `Skipped: ${lock.reason}`,
      };
      if (trigger === 'MANUAL' || Date.now() - this.lastSkipLog > SKIP_LOG_EVERY_MS) {
        this.lastSkipLog = Date.now();
        await this.record(trigger, r);
      }
      return r;
    }

    try {
      const aggressive = level === 'EMERGENCY' || level === 'SAFE';
      const notes: string[] = [];
      let bytes = 0;
      let imagesRemoved = 0;
      let errors = 0;

      try {
        const freed = aggressive
          ? await this.pruneBuildCache(true)
          : await this.pruneBuildCache(false, CACHE_MAX_AGE_NORMAL);
        bytes += freed;
        notes.push(`build cache freed ${freed} bytes`);
      } catch (e: any) { errors++; notes.push(`build cache failed: ${e.message}`); }

      try {
        // Candidates are computed now, with the lock held, so nothing new can appear mid-way.
        const cands = await this.candidateImages({
          graceMs: aggressive ? GRACE_AGGRESSIVE_MS : GRACE_NORMAL_MS,
          onlyOurs: !aggressive,
        });
        const res = await this.removeImages(cands);
        bytes += res.bytes;
        imagesRemoved = res.removed;
        notes.push(`images ${res.removed}/${cands.length} removed`);
      } catch (e: any) { errors++; notes.push(`images failed: ${e.message}`); }

      let usageAfter: number | null = null;
      try { usageAfter = (await this.getDiskUsage()).usedPercent; } catch { /* ignore */ }

      const result: CleanupResult = {
        status: errors === 2 ? 'FAILED' : 'SUCCESS',
        level, usageBefore, usageAfter,
        bytesReclaimed: bytes, imagesRemoved, details: notes.join('; '),
      };
      await this.record(trigger, result);
      logger.info(`Storage cleanup [${trigger}/${level}] ${result.status}: ${result.details} (disk ${usageBefore}% -> ${usageAfter ?? '?'}%)`);
      return result;
    } catch (e: any) {
      const result: CleanupResult = {
        status: 'FAILED', level, usageBefore, usageAfter: null, bytesReclaimed: 0, imagesRemoved: 0, details: e.message,
      };
      await this.record(trigger, result);
      logger.error(`Storage cleanup failed: ${e.message}`);
      return result;
    } finally {
      lock.release();
    }
  }

  /** Manual "Safe Cleanup" button. */
  static safeCleanup() {
    return this.runCleanup('SAFE', 'MANUAL');
  }

  // ---------- Monitor ----------

  static async checkOnce(): Promise<void> {
    if (!storageConfig.enabled) return;
    let disk: DiskUsage;
    try {
      disk = await this.getDiskUsage();
    } catch (e: any) {
      logger.warn(`Storage monitor: cannot read disk usage: ${e.message}`);
      return;
    }
    const level = this.levelFor(disk.usedPercent);
    if (level === 'OK') return;

    if (level === 'WARNING') {
      if (Date.now() - this.lastWarnLog > WARNING_LOG_EVERY_MS) {
        this.lastWarnLog = Date.now();
        logger.warn(`Disk usage at ${disk.usedPercent}% (warning threshold ${storageConfig.warnPct}%)`);
        await this.record('AUTO', {
          status: 'SUCCESS', level: 'WARNING', usageBefore: disk.usedPercent, usageAfter: null,
          bytesReclaimed: 0, imagesRemoved: 0,
          details: `Disk usage ${disk.usedPercent}% crossed the warning threshold; no cleanup performed`,
        });
      }
      return;
    }

    logger.warn(`Disk usage at ${disk.usedPercent}% - running ${level} cleanup`);
    const r = await this.runCleanup(level === 'EMERGENCY' ? 'EMERGENCY' : 'CLEANUP', 'AUTO');
    // Normal cleanup wasn't enough and we are in the emergency band -> escalate.
    if (r.status === 'SUCCESS' && level === 'CLEANUP' && (r.usageAfter ?? 0) >= storageConfig.emergencyPct) {
      await this.runCleanup('EMERGENCY', 'AUTO');
    }
  }

  static startMonitor() {
    if (this.timer) return;
    if (!storageConfig.enabled) {
      logger.info('Automatic storage management disabled (STORAGE_AUTO_CLEANUP=false)');
      return;
    }
    const run = () => this.checkOnce().catch((e) => logger.error('Storage monitor error:', e));
    this.timer = setInterval(run, storageConfig.checkIntervalMs);
    this.timer.unref?.();
    setTimeout(run, 2 * 60 * 1000).unref?.();
    logger.info(
      `Storage monitor started (warn ${storageConfig.warnPct}% / cleanup ${storageConfig.cleanupPct}% / emergency ${storageConfig.emergencyPct}%)`,
    );
  }
}
