import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';
import { AppError } from '../types';
import { decrypt } from './encryption.service';
import { NotificationService } from './notification.service';
import { StorageManagerService, storageConfig } from './storage-manager.service';

/**
 * Logical backups (pg_dump / mariadb-dump, gzipped) of per-project databases and
 * of the CloudDabba platform database. Dump tools are taken from PATH; for
 * PostgreSQL a `docker exec` into the Postgres container is the fallback, since
 * Postgres usually runs in Docker without client tools on the host.
 *
 * Redis is intentionally not backed up: it is used as a cache/queue namespace.
 */

export type Engine = 'POSTGRES' | 'MARIADB';
type Trigger = 'AUTO' | 'MANUAL' | 'PRE_RESTORE';

export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), '..', 'backups'));
const PG_CONTAINER = process.env.PG_DOCKER_CONTAINER || 'clouddabba-db';
const KEEP: Record<Trigger, number> = {
  AUTO: Number(process.env.BACKUP_RETENTION) > 0 ? Number(process.env.BACKUP_RETENTION) : 7,
  MANUAL: 10,
  PRE_RESTORE: 3,
};
const AUTO_ENABLED = process.env.BACKUP_AUTO !== 'false';
const TICK_MS = 30 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

interface Conn { host: string; port: number; user: string; password: string; database: string }

class ToolMissing extends Error {}

function redact(text: string, secret: string) {
  return secret ? text.split(secret).join('***') : text;
}

/** Runs a command; resolves with exit code and the tail of stderr. stdin/stdout are handed to the caller. */
function run(cmd: string, args: string[], env: Record<string, string>, io: {
  stdin?: NodeJS.ReadableStream; stdout?: NodeJS.WritableStream;
}): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: [io.stdin ? 'pipe' : 'ignore', io.stdout ? 'pipe' : 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr!.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-2000); });
    child.on('error', (e: any) => (e.code === 'ENOENT' ? reject(new ToolMissing(cmd)) : reject(e)));
    const piping: Promise<unknown>[] = [];
    // Only wire the streams once the process really started: a missing binary (ENOENT) must
    // leave the caller's streams untouched so the next candidate tool can reuse them.
    child.on('spawn', () => {
      if (io.stdout) { const p = pipeline(child.stdout!, io.stdout); p.catch(() => undefined); piping.push(p); }
      if (io.stdin) { const p = pipeline(io.stdin, child.stdin!).catch(() => undefined); piping.push(p); }
    });
    child.on('close', async (code) => {
      try { await Promise.all(piping); } catch (e) { return reject(e); }
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export class BackupService {
  private static queue: Promise<unknown> = Promise.resolve();
  private static restoring = new Map<string, { startedAt: number }>();
  private static lastRestore = new Map<string, { backupId: string; ok: boolean; error?: string; at: number }>();
  private static timer: NodeJS.Timeout | null = null;

  // ---------- connections ----------

  private static projectConn(project: any, engine: Engine): Conn {
    if (engine === 'POSTGRES') {
      if (!project.dbEnabled || !project.dbName || !project.dbUser || !project.dbPasswordEnc) {
        throw new AppError('PostgreSQL is not enabled for this project', 400);
      }
      return {
        host: config.provisionDb.host, port: config.provisionDb.port,
        user: project.dbUser, password: decrypt(project.dbPasswordEnc), database: project.dbName,
      };
    }
    if (!project.mariadbEnabled || !project.mariadbName || !project.mariadbUser || !project.mariadbPasswordEnc) {
      throw new AppError('MariaDB is not enabled for this project', 400);
    }
    return {
      host: config.mariadb.host, port: config.mariadb.port,
      user: project.mariadbUser, password: decrypt(project.mariadbPasswordEnc), database: project.mariadbName,
    };
  }

  private static platformConn(): Conn {
    const u = new URL(config.db.url);
    return {
      host: u.hostname, port: Number(u.port) || 5432,
      user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }

  // ---------- dump / restore primitives ----------

  private static async pgTool(tool: 'pg_dump' | 'psql', c: Conn, extra: string[], io: Parameters<typeof run>[3]) {
    const common = ['-h', c.host, '-p', String(c.port), '-U', c.user];
    const env = { PGPASSWORD: c.password };
    try {
      return await run(process.env[tool === 'pg_dump' ? 'PG_DUMP_PATH' : 'PSQL_PATH'] || tool, [...common, ...extra, c.database], env, io);
    } catch (e) {
      if (!(e instanceof ToolMissing)) throw e;
    }
    // Fallback: run inside the Postgres container (connects over its own loopback).
    const args = ['exec', ...(io.stdin ? ['-i'] : []), '-e', 'PGPASSWORD', PG_CONTAINER, tool,
      '-h', '127.0.0.1', '-p', '5432', '-U', c.user, ...extra, c.database];
    try {
      return await run('docker', args, env, io);
    } catch (e) {
      if (e instanceof ToolMissing) throw new AppError('pg_dump/psql not found and Docker CLI unavailable. Install postgresql-client on the server.', 500);
      throw e;
    }
  }

  private static async mariaTool(kind: 'dump' | 'restore', c: Conn, io: Parameters<typeof run>[3]) {
    const common = ['-h', c.host, '-P', String(c.port), '-u', c.user];
    const env = { MYSQL_PWD: c.password };
    const candidates = kind === 'dump'
      ? [['mariadb-dump', ['--single-transaction', '--routines', '--triggers', '--no-tablespaces']], ['mysqldump', ['--single-transaction', '--routines', '--triggers', '--no-tablespaces']]]
      : [['mariadb', []], ['mysql', []]];
    for (const [bin, extra] of candidates as [string, string[]][]) {
      try {
        return await run(bin, [...common, ...extra, c.database], env, io);
      } catch (e) {
        if (!(e instanceof ToolMissing)) throw e;
      }
    }
    throw new AppError('mariadb-dump/mysqldump not found on the server. Install mariadb-client.', 500);
  }

  private static async dumpTo(file: string, engine: Engine, c: Conn) {
    const out = fs.createWriteStream(file, { mode: 0o600 });
    const gz = zlib.createGzip();
    const sink = gz;
    const writing = pipeline(gz, out);
    try {
      const res = engine === 'POSTGRES'
        ? await this.pgTool('pg_dump', c, ['--no-owner', '--no-privileges', '--clean', '--if-exists'], { stdout: sink })
        : await this.mariaTool('dump', c, { stdout: sink });
      await writing;
      if (res.code !== 0) throw new Error(redact(res.stderr.trim() || `dump exited with code ${res.code}`, c.password));
    } catch (e) {
      gz.destroy();
      await writing.catch(() => undefined);
      throw e;
    }
  }

  private static async restoreFrom(file: string, engine: Engine, c: Conn) {
    const input = fs.createReadStream(file).pipe(zlib.createGunzip());
    const res = engine === 'POSTGRES'
      // -1 = single transaction: a failing restore rolls back instead of leaving a half-restored DB
      ? await this.pgTool('psql', c, ['-q', '-1', '-v', 'ON_ERROR_STOP=1'], { stdin: input })
      : await this.mariaTool('restore', c, { stdin: input });
    if (res.code !== 0) throw new Error(redact(res.stderr.trim() || `restore exited with code ${res.code}`, c.password));
  }

  // ---------- public API ----------

  private static async diskGuard(trigger: Trigger) {
    try {
      const d = await StorageManagerService.getDiskUsage();
      const limit = trigger === 'AUTO' ? storageConfig.emergencyPct : 98;
      if (d.usedPercent >= limit) throw new AppError(`Disk is ${d.usedPercent}% full - backup skipped to avoid filling it`, 507);
    } catch (e) {
      if (e instanceof AppError) throw e;
    }
  }

  /** Creates the DB row immediately and runs the dump in the background queue. */
  static async start(opts: {
    scope: 'PROJECT' | 'PLATFORM'; project?: any; engine: Engine; trigger: Trigger; by?: string;
  }) {
    const conn = opts.scope === 'PLATFORM' ? this.platformConn() : this.projectConn(opts.project, opts.engine);
    await this.diskGuard(opts.trigger);
    await fsp.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });

    const row = await prisma.backup.create({
      data: {
        scope: opts.scope, projectId: opts.project?.id, engine: opts.engine,
        trigger: opts.trigger, status: 'RUNNING', createdBy: opts.by,
      },
    });
    const fileName = `${row.id}.sql.gz`;
    const finalPath = path.join(BACKUP_DIR, fileName);

    const job = this.queue.then(async () => {
      const tmp = `${finalPath}.part`;
      try {
        await this.dumpTo(tmp, opts.engine, conn);
        const st = await fsp.stat(tmp);
        if (st.size < 20) throw new Error('Backup produced an empty file');
        await fsp.rename(tmp, finalPath);
        await prisma.backup.update({ where: { id: row.id }, data: { status: 'SUCCESS', fileName, sizeBytes: BigInt(st.size) } });
        await this.applyRetention(opts.scope, opts.project?.id, opts.engine, opts.trigger);
      } catch (e: any) {
        await fsp.rm(tmp, { force: true }).catch(() => undefined);
        const msg = String(e?.message || e).slice(0, 1000);
        await prisma.backup.update({ where: { id: row.id }, data: { status: 'FAILED', error: msg } }).catch(() => undefined);
        logger.error(`Backup ${row.id} (${opts.scope}/${opts.engine}) failed: ${msg}`);
        if (opts.trigger === 'AUTO') {
          NotificationService.notify('backupFailed', 'Database backup failed',
            `${opts.scope === 'PLATFORM' ? 'Platform database' : `Project ${opts.project?.name} (${opts.engine})`}: ${msg}`,
            { dedupeKey: `${opts.scope}:${opts.project?.id || ''}:${opts.engine}`, cooldownMs: 12 * 60 * 60 * 1000 });
        }
      }
    });
    this.queue = job.catch(() => undefined);
    return { row, done: job };
  }

  private static async applyRetention(scope: string, projectId: string | undefined, engine: string, trigger: Trigger) {
    const old = await prisma.backup.findMany({
      where: { scope, projectId: projectId ?? null, engine, trigger, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' }, skip: KEEP[trigger], select: { id: true, fileName: true },
    });
    for (const b of old) await this.removeFiles(b);
    if (old.length) await prisma.backup.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  private static async removeFiles(b: { fileName: string | null }) {
    if (b.fileName) await fsp.rm(path.join(BACKUP_DIR, path.basename(b.fileName)), { force: true }).catch(() => undefined);
  }

  static async listForProject(projectId: string, userId: string) {
    await this.ownedProject(projectId, userId);
    const rows = await prisma.backup.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return {
      backups: rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) })),
      restoring: this.restoring.has(projectId),
      lastRestore: this.lastRestore.get(projectId) || null,
    };
  }

  static async listPlatform() {
    const rows = await prisma.backup.findMany({ where: { scope: 'PLATFORM' }, orderBy: { createdAt: 'desc' }, take: 30 });
    return rows.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) }));
  }

  private static async ownedProject(projectId: string, userId: string) {
    const project: any = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);
    return project;
  }

  static async createForProject(projectId: string, userId: string, engine: Engine, by: string) {
    const project = await this.ownedProject(projectId, userId);
    if (this.restoring.has(projectId)) throw new AppError('A restore is in progress for this project', 409);
    const running = await prisma.backup.count({ where: { projectId, engine, status: 'RUNNING' } });
    if (running > 0) throw new AppError('A backup is already running for this database', 409);
    const { row } = await this.start({ scope: 'PROJECT', project, engine, trigger: 'MANUAL', by });
    return { ...row, sizeBytes: 0 };
  }

  static async createPlatform(by: string) {
    const running = await prisma.backup.count({ where: { scope: 'PLATFORM', status: 'RUNNING' } });
    if (running > 0) throw new AppError('A platform backup is already running', 409);
    const { row } = await this.start({ scope: 'PLATFORM', engine: 'POSTGRES', trigger: 'MANUAL', by });
    return { ...row, sizeBytes: 0 };
  }

  /** Returns the file path + a friendly download name; ownership is checked for project backups. */
  static async getDownload(backupId: string, opts: { userId?: string; admin?: boolean }) {
    const b = await prisma.backup.findUnique({ where: { id: backupId }, include: { project: true } });
    if (!b || b.status !== 'SUCCESS' || !b.fileName) throw new AppError('Backup not found', 404);
    if (b.scope === 'PLATFORM' ? !opts.admin : b.project?.userId !== opts.userId) throw new AppError('Unauthorized', 403);
    const file = path.join(BACKUP_DIR, path.basename(b.fileName));
    if (!fs.existsSync(file)) throw new AppError('Backup file is missing on disk', 410);
    const stamp = b.createdAt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const label = b.scope === 'PLATFORM' ? 'clouddabba-platform' : b.project?.subdomain || 'project';
    return { file, name: `${label}-${b.engine.toLowerCase()}-${stamp}.sql.gz`, backup: b };
  }

  static async remove(backupId: string, opts: { userId?: string; admin?: boolean }) {
    const b = await prisma.backup.findUnique({ where: { id: backupId }, include: { project: true } });
    if (!b) throw new AppError('Backup not found', 404);
    if (b.scope === 'PLATFORM' ? !opts.admin : b.project?.userId !== opts.userId) throw new AppError('Unauthorized', 403);
    if (b.status === 'RUNNING') throw new AppError('Backup is still running', 409);
    await this.removeFiles(b);
    await prisma.backup.delete({ where: { id: backupId } });
    return b;
  }

  /**
   * Restore a project backup into its live database. A PRE_RESTORE backup is taken
   * first (and awaited); if it fails the restore is refused.
   */
  static async restore(projectId: string, backupId: string, userId: string, by: string) {
    const project = await this.ownedProject(projectId, userId);
    const b = await prisma.backup.findUnique({ where: { id: backupId } });
    if (!b || b.projectId !== projectId || b.status !== 'SUCCESS' || !b.fileName) throw new AppError('Backup not found', 404);
    if (this.restoring.has(projectId)) throw new AppError('A restore is already in progress', 409);
    const engine = b.engine as Engine;
    const conn = this.projectConn(project, engine); // also proves the DB is still enabled
    const file = path.join(BACKUP_DIR, path.basename(b.fileName));
    if (!fs.existsSync(file)) throw new AppError('Backup file is missing on disk', 410);

    this.restoring.set(projectId, { startedAt: Date.now() });
    void (async () => {
      try {
        const safety = await this.start({ scope: 'PROJECT', project, engine, trigger: 'PRE_RESTORE', by });
        await safety.done;
        const check = await prisma.backup.findUnique({ where: { id: safety.row.id } });
        if (check?.status !== 'SUCCESS') throw new Error(`Safety backup failed, restore cancelled: ${check?.error || 'unknown error'}`);
        await this.restoreFrom(file, engine, conn);
        this.lastRestore.set(projectId, { backupId, ok: true, at: Date.now() });
        logger.info(`Restored backup ${backupId} into project ${projectId}`);
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 500);
        this.lastRestore.set(projectId, { backupId, ok: false, error: msg, at: Date.now() });
        logger.error(`Restore of ${backupId} failed: ${msg}`);
      } finally {
        this.restoring.delete(projectId);
      }
    })();
  }

  /** Delete every backup file of a project (called before the project is deleted). */
  static async deleteForProject(projectId: string) {
    const rows = await prisma.backup.findMany({ where: { projectId }, select: { fileName: true } });
    for (const r of rows) await this.removeFiles(r);
  }

  // ---------- scheduler ----------

  static async runDue() {
    if (!AUTO_ENABLED) return;
    const since = new Date(Date.now() - DAY + 30 * 60 * 1000);
    const recent = async (where: any) =>
      (await prisma.backup.count({ where: { ...where, trigger: 'AUTO', status: { in: ['SUCCESS', 'RUNNING'] }, createdAt: { gt: since } } })) > 0;

    try {
      if (!(await recent({ scope: 'PLATFORM' }))) {
        await (await this.start({ scope: 'PLATFORM', engine: 'POSTGRES', trigger: 'AUTO' })).done;
      }
      const projects: any[] = await prisma.project.findMany({ where: { OR: [{ dbEnabled: true }, { mariadbEnabled: true }] } });
      for (const p of projects) {
        for (const engine of ['POSTGRES', 'MARIADB'] as Engine[]) {
          if (engine === 'POSTGRES' ? !p.dbEnabled : !p.mariadbEnabled) continue;
          if (this.restoring.has(p.id) || (await recent({ projectId: p.id, engine }))) continue;
          await (await this.start({ scope: 'PROJECT', project: p, engine, trigger: 'AUTO' })).done;
        }
      }
    } catch (e: any) {
      // Disk guard or a config problem: log once per tick, try again next tick.
      logger.warn(`Scheduled backups: ${e.message}`);
    }
  }

  static async recoverStuck() {
    // Rows left RUNNING by a crash/restart can never finish.
    await prisma.backup.updateMany({ where: { status: 'RUNNING' }, data: { status: 'FAILED', error: 'Interrupted by a server restart' } }).catch(() => undefined);
  }

  static startScheduler() {
    if (this.timer) return;
    void this.recoverStuck();
    if (!AUTO_ENABLED) { logger.info('Automatic backups disabled (BACKUP_AUTO=false)'); return; }
    this.timer = setInterval(() => void this.runDue(), TICK_MS);
    this.timer.unref?.();
    setTimeout(() => void this.runDue(), 3 * 60 * 1000).unref?.();
    logger.info(`Backup scheduler started (dir ${BACKUP_DIR}, keep ${KEEP.AUTO} daily)`);
  }
}
