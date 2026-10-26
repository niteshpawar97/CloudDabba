import os from 'os';
import docker from '../../infrastructure/docker/docker-client';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { AppError } from '../types';

/**
 * Per-project resource monitoring.
 *
 * A sampler polls every running CloudDabba-managed container (single-container
 * deployments via the `clouddabba.project` label, compose deployments via the
 * `cd-<subdomain>` compose project) and keeps a short in-memory history per
 * project. History is intentionally not persisted: it is operational telemetry,
 * and a restart only resets the charts.
 */

const SAMPLE_INTERVAL_MS = 30 * 1000;
const HISTORY_POINTS = 120; // 1 hour at 30s
const CONCURRENCY = 5;

export const LIMITS = {
  memoryMinMb: 128,
  cpuMin: 0.25,
  cpuMax: 4,
};
export const DEFAULT_MEMORY_MB = 512;
export const DEFAULT_CPU = 0.5;

/** Largest memory limit a user may request: 4 GB, but never more than 80% of the host. */
export function maxMemoryMb(): number {
  return Math.max(LIMITS.memoryMinMb, Math.min(4096, Math.floor((os.totalmem() / 1024 / 1024) * 0.8)));
}

export interface MetricPoint {
  t: number;          // epoch ms
  cpu: number;        // % of one CPU core... summed across the project's containers
  memUsage: number;   // bytes
  memLimit: number;   // bytes
  netRxRate: number;  // bytes/s
  netTxRate: number;  // bytes/s
}

interface Raw { netRx: number; netTx: number; t: number }

export class ResourceMonitorService {
  private static history = new Map<string, MetricPoint[]>();
  private static lastRaw = new Map<string, Raw>();
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;

  // ---------- sampling ----------

  private static async sampleContainer(id: string) {
    const s: any = await docker.getContainer(id).stats({ stream: false });
    const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage || 0) - (s.precpu_stats?.cpu_usage?.total_usage || 0);
    const sysDelta = (s.cpu_stats?.system_cpu_usage || 0) - (s.precpu_stats?.system_cpu_usage || 0);
    const cpus = s.cpu_stats?.online_cpus || 1;
    const cpu = sysDelta > 0 && cpuDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0;

    // Page cache is reclaimable and inflates "usage"; subtract it like `docker stats` does.
    const cache = s.memory_stats?.stats?.inactive_file ?? s.memory_stats?.stats?.cache ?? 0;
    const memUsage = Math.max(0, (s.memory_stats?.usage || 0) - cache);
    const memLimit = s.memory_stats?.limit || 0;

    let rx = 0;
    let tx = 0;
    for (const n of Object.values<any>(s.networks || {})) {
      rx += n.rx_bytes || 0;
      tx += n.tx_bytes || 0;
    }
    return { cpu, memUsage, memLimit, rx, tx };
  }

  private static async mapContainersToProjects(): Promise<Map<string, string[]>> {
    const [containers, projects] = await Promise.all([
      docker.listContainers({ filters: { status: ['running'] } }),
      prisma.project.findMany({ select: { id: true, subdomain: true } }),
    ]);
    const byCompose = new Map(projects.map((p) => [`cd-${p.subdomain}`, p.id]));
    const known = new Set(projects.map((p) => p.id));
    const out = new Map<string, string[]>();
    for (const c of containers as any[]) {
      const labels = c.Labels || {};
      let pid: string | undefined = labels['clouddabba.project'];
      if (!pid && labels['com.docker.compose.project']) pid = byCompose.get(labels['com.docker.compose.project']);
      if (!pid || !known.has(pid)) continue;
      if (!out.has(pid)) out.set(pid, []);
      out.get(pid)!.push(c.Id);
    }
    return out;
  }

  static async sampleAll() {
    if (this.running) return;
    this.running = true;
    try {
      const map = await this.mapContainersToProjects();
      const now = Date.now();

      const jobs: Array<() => Promise<void>> = [];
      for (const [projectId, ids] of map) {
        jobs.push(async () => {
          const results = await Promise.all(ids.map((id) => this.sampleContainer(id).catch(() => null)));
          const ok = results.filter(Boolean) as Awaited<ReturnType<typeof ResourceMonitorService.sampleContainer>>[];
          if (ok.length === 0) return;
          const sum = (f: (r: (typeof ok)[number]) => number) => ok.reduce((n, r) => n + f(r), 0);

          const netRx = sum((r) => r.rx);
          const netTx = sum((r) => r.tx);
          const prev = this.lastRaw.get(projectId);
          let rxRate = 0;
          let txRate = 0;
          if (prev && now > prev.t && netRx >= prev.netRx && netTx >= prev.netTx) {
            const dt = (now - prev.t) / 1000;
            rxRate = (netRx - prev.netRx) / dt;
            txRate = (netTx - prev.netTx) / dt;
          }
          this.lastRaw.set(projectId, { netRx, netTx, t: now });

          const point: MetricPoint = {
            t: now,
            cpu: Math.round(sum((r) => r.cpu) * 10) / 10,
            memUsage: sum((r) => r.memUsage),
            memLimit: sum((r) => r.memLimit),
            netRxRate: Math.round(rxRate),
            netTxRate: Math.round(txRate),
          };
          const h = this.history.get(projectId) || [];
          h.push(point);
          if (h.length > HISTORY_POINTS) h.splice(0, h.length - HISTORY_POINTS);
          this.history.set(projectId, h);
        });
      }

      // Bounded concurrency — each stats call blocks ~1s on the Docker side.
      const queue = [...jobs];
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
          while (queue.length) await queue.shift()!();
        }),
      );

      // Forget projects that no longer have running containers.
      for (const id of [...this.history.keys()]) {
        if (!map.has(id)) {
          const h = this.history.get(id)!;
          if (now - h[h.length - 1].t > 10 * 60 * 1000) { this.history.delete(id); this.lastRaw.delete(id); }
        }
      }
    } catch (e: any) {
      logger.warn(`Resource sampling failed: ${e.message}`);
    } finally {
      this.running = false;
    }
  }

  static startMonitor() {
    if (this.timer) return;
    this.timer = setInterval(() => this.sampleAll(), SAMPLE_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => this.sampleAll(), 15 * 1000).unref?.();
  }

  // ---------- queries ----------

  static getHistory(projectId: string): MetricPoint[] {
    return this.history.get(projectId) || [];
  }

  static async getProjectMetrics(projectId: string, userId: string) {
    const project: any = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const history = this.getHistory(projectId);
    return {
      current: history.length ? history[history.length - 1] : null,
      history,
      intervalSec: SAMPLE_INTERVAL_MS / 1000,
      limits: {
        memoryMb: project.memoryLimitMb ?? DEFAULT_MEMORY_MB,
        cpu: project.cpuLimit ?? DEFAULT_CPU,
        maxMemoryMb: maxMemoryMb(),
        minMemoryMb: LIMITS.memoryMinMb,
        minCpu: LIMITS.cpuMin,
        maxCpu: LIMITS.cpuMax,
        // Compose projects manage their own limits in docker-compose.yml
        editable: project.projectType !== 'DOCKER_COMPOSE' && project.projectType !== 'ERPNEXT',
      },
    };
  }

  /** Host totals + every project's latest sample, for the admin dashboard. */
  static async getOverview() {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, subdomain: true, user: { select: { email: true } } },
    });
    const rows = projects
      .map((p) => {
        const h = this.getHistory(p.id);
        const cur = h[h.length - 1];
        return cur ? { projectId: p.id, name: p.name, subdomain: p.subdomain, owner: p.user.email, ...cur } : null;
      })
      .filter(Boolean) as any[];

    const total = os.totalmem();
    const free = os.freemem();
    return {
      host: {
        cpuCount: os.cpus().length,
        load1: os.loadavg()[0],
        memTotal: total,
        memUsed: total - free,
      },
      projects: rows.sort((a, b) => b.memUsage - a.memUsage),
    };
  }

  // ---------- limits ----------

  static validateLimits(memoryMb: unknown, cpu: unknown) {
    const m = Number(memoryMb);
    const c = Number(cpu);
    const maxMem = maxMemoryMb();
    if (!Number.isInteger(m) || m < LIMITS.memoryMinMb || m > maxMem) {
      throw new AppError(`Memory must be a whole number between ${LIMITS.memoryMinMb} and ${maxMem} MB`, 400);
    }
    if (!Number.isFinite(c) || c < LIMITS.cpuMin || c > LIMITS.cpuMax) {
      throw new AppError(`CPU must be between ${LIMITS.cpuMin} and ${LIMITS.cpuMax} cores`, 400);
    }
    return { memoryMb: m, cpu: Math.round(c * 100) / 100 };
  }

  /** Saves the limits and applies them live to the project's running container. */
  static async updateLimits(projectId: string, userId: string, memoryMb: unknown, cpu: unknown) {
    const project: any = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);
    if (project.projectType === 'DOCKER_COMPOSE' || project.projectType === 'ERPNEXT') {
      throw new AppError('Compose projects set resource limits in their docker-compose.yml', 400);
    }
    const { memoryMb: m, cpu: c } = this.validateLimits(memoryMb, cpu);

    await (prisma.project.update as any)({ where: { id: projectId }, data: { memoryLimitMb: m, cpuLimit: c } });

    let applied = 0;
    try {
      const running = await docker.listContainers({ filters: { label: [`clouddabba.project=${projectId}`], status: ['running'] } });
      for (const info of running as any[]) {
        const bytes = m * 1024 * 1024;
        // MemorySwap must be >= Memory; keep Docker's default of 2x so swap behaviour is unchanged.
        await docker.getContainer(info.Id).update({ Memory: bytes, MemorySwap: bytes * 2, NanoCpus: Math.round(c * 1e9) } as any);
        applied++;
      }
    } catch (e: any) {
      logger.warn(`Saved limits for ${projectId} but could not apply live: ${e.message}`);
      return { memoryMb: m, cpu: c, appliedLive: false, note: 'Saved. Will take effect on the next deploy.' };
    }
    return { memoryMb: m, cpu: c, appliedLive: applied > 0, note: applied > 0 ? 'Applied to the running container.' : 'Saved. Will apply on the next deploy.' };
  }
}
