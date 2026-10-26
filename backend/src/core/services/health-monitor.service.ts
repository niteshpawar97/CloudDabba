import docker from '../../infrastructure/docker/docker-client';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { NotificationService } from './notification.service';

/**
 * Watches the Docker daemon and container health so problems that used to go
 * unnoticed (a stale containerd shim, an unhealthy or crash-looping container,
 * a "LIVE" deployment whose container is gone) show up on the admin dashboard
 * and trigger a notification.
 */

const CHECK_INTERVAL_MS = 60 * 1000;
const RENOTIFY_MS = 6 * 60 * 60 * 1000;
const CONFIRM_CHECKS = 2; // must be bad on this many consecutive checks before alerting

// Errors that mean "the Docker host itself is broken", not "this app failed to build".
const DAEMON_ERROR =
  /failed to start shim|bootstrap parameters do not match|failed to create task for container|containerd|OCI runtime|cannot connect to the docker daemon|is the docker daemon running|connect (ENOENT|ECONNREFUSED|EACCES).*docker|docker\.sock/i;

const DAEMON_HINT = 'Restart the Docker services on the server: sudo systemctl restart containerd docker (containers with an unless-stopped policy come back automatically).';

export type IssueKind = 'unhealthy' | 'restarting' | 'down';

export interface ContainerIssue {
  id: string;
  name: string;
  kind: IssueKind;
  status: string;
  managed: boolean;
  projectId?: string;
  projectName?: string;
  since: number;
}

interface DaemonState {
  ok: boolean;
  error?: string;
  hint?: string;
  detectedAt?: number;
  source?: 'ping' | 'deploy';
}

export class HealthMonitorService {
  private static daemon: DaemonState = { ok: true };
  private static issues: ContainerIssue[] = [];
  private static counts = { total: 0, running: 0 };
  private static checkedAt = 0;
  private static firstSeen = new Map<string, number>();
  private static streak = new Map<string, number>();
  private static notifiedAt = new Map<string, number>();
  private static timer: NodeJS.Timeout | null = null;
  private static checking = false;

  // ---------- daemon state ----------

  /** Called when a deploy/start fails; flags the host if the error looks like a daemon problem. */
  static reportDockerError(message: string): boolean {
    if (!DAEMON_ERROR.test(message || '')) return false;
    const short = message.length > 300 ? `${message.slice(0, 300)}...` : message;
    if (this.daemon.ok || this.daemon.error !== short) {
      this.daemon = { ok: false, error: short, hint: DAEMON_HINT, detectedAt: Date.now(), source: 'deploy' };
      logger.error(`Docker daemon problem detected: ${short}`);
      NotificationService.notify('dockerDaemon', 'Docker daemon needs attention', `${short}\n\n${DAEMON_HINT}`, {
        dedupeKey: 'daemon', cooldownMs: 3 * 60 * 60 * 1000,
      });
    }
    return true;
  }

  /** Called after a container is started successfully — proves the daemon works again. */
  static reportDockerOk() {
    if (!this.daemon.ok && this.daemon.source === 'deploy') this.daemon = { ok: true };
  }

  private static async pingDaemon() {
    try {
      await docker.ping();
      if (!this.daemon.ok && this.daemon.source === 'ping') this.daemon = { ok: true };
    } catch (e: any) {
      const msg = `Docker daemon is not responding: ${e.message}`;
      if (this.daemon.ok) {
        this.daemon = { ok: false, error: msg, hint: DAEMON_HINT, detectedAt: Date.now(), source: 'ping' };
        NotificationService.notify('dockerDaemon', 'Docker daemon is down', `${msg}\n\n${DAEMON_HINT}`, {
          dedupeKey: 'daemon', cooldownMs: 3 * 60 * 60 * 1000,
        });
      }
      throw e;
    }
  }

  // ---------- container checks ----------

  static async checkOnce() {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.pingDaemon();

      const [containers, projects, live] = await Promise.all([
        docker.listContainers({ all: true }),
        prisma.project.findMany({ select: { id: true, name: true, subdomain: true } }),
        prisma.deployment.findMany({
          where: { status: 'LIVE' as any, containerId: { not: null } },
          select: { containerId: true, projectId: true },
        }),
      ]);

      const nameOf = new Map(projects.map((p) => [p.id, p.name]));
      const byCompose = new Map(projects.map((p) => [`cd-${p.subdomain}`, p.id]));
      const found: ContainerIssue[] = [];
      const now = Date.now();

      for (const c of containers as any[]) {
        const name = (c.Names?.[0] || c.Id).replace(/^\//, '');
        const labels = c.Labels || {};
        const projectId: string | undefined =
          labels['clouddabba.project'] || byCompose.get(labels['com.docker.compose.project']);
        let kind: IssueKind | null = null;
        if (c.State === 'restarting') kind = 'restarting';
        else if (c.State === 'running' && /\(unhealthy\)/i.test(c.Status || '')) kind = 'unhealthy';
        if (kind) {
          found.push({
            id: c.Id, name, kind, status: c.Status, managed: !!projectId,
            projectId, projectName: projectId ? nameOf.get(projectId) : undefined, since: now,
          });
        }
      }

      // A LIVE single-container deployment whose container is not running = unexpectedly down.
      const running = new Set((containers as any[]).filter((c) => c.State === 'running').map((c) => c.Id));
      const existing = new Map((containers as any[]).map((c) => [c.Id, c]));
      for (const d of live) {
        if (!d.containerId || d.containerId.startsWith('compose:')) continue;
        const full = [...existing.keys()].find((id) => id.startsWith(d.containerId!) || d.containerId!.startsWith(id));
        if (full && running.has(full)) continue;
        const c: any = full ? existing.get(full) : null;
        found.push({
          id: d.containerId, name: c ? (c.Names?.[0] || '').replace(/^\//, '') : d.containerId.slice(0, 12),
          kind: 'down', status: c ? c.Status : 'container missing', managed: true,
          projectId: d.projectId, projectName: nameOf.get(d.projectId), since: now,
        });
      }

      // Track how long each issue has persisted; resolve the ones that cleared.
      const keys = new Set<string>();
      for (const i of found) {
        const key = `${i.kind}:${i.id}`;
        keys.add(key);
        if (!this.firstSeen.has(key)) this.firstSeen.set(key, now);
        i.since = this.firstSeen.get(key)!;
        this.streak.set(key, (this.streak.get(key) || 0) + 1);
      }
      for (const k of [...this.firstSeen.keys()]) {
        if (!keys.has(k)) { this.firstSeen.delete(k); this.streak.delete(k); }
      }

      this.issues = found;
      this.counts = { total: containers.length, running: running.size };
      this.checkedAt = now;

      // One grouped notification per cycle, covering only issues not alerted in the last 6h.
      const confirmed = found.filter((i) => (this.streak.get(`${i.kind}:${i.id}`) || 0) >= CONFIRM_CHECKS);
      const fresh = confirmed.filter((i) => now - (this.notifiedAt.get(`${i.kind}:${i.id}`) || 0) > RENOTIFY_MS);
      if (fresh.length) {
        for (const i of fresh) this.notifiedAt.set(`${i.kind}:${i.id}`, now);
        const lines = fresh.map((i) =>
          `- ${i.name}${i.projectName ? ` (${i.projectName})` : ''}: ${i.kind === 'down' ? 'not running but marked LIVE' : i.kind} - ${i.status}`);
        NotificationService.notify('containerUnhealthy', `${fresh.length} container issue(s) on the server`, lines.join(String.fromCharCode(10)));
      }
      for (const k of [...this.notifiedAt.keys()]) if (!keys.has(k)) this.notifiedAt.delete(k);
    } catch (e: any) {
      if (this.daemon.ok) logger.warn(`Health check failed: ${e.message}`);
    } finally {
      this.checking = false;
    }
  }

  static async getStatus() {
    if (!this.checkedAt) await this.checkOnce();
    return {
      daemon: this.daemon,
      issues: this.issues.map((i) => ({ ...i, confirmed: (this.streak.get(`${i.kind}:${i.id}`) || 0) >= CONFIRM_CHECKS })),
      containers: this.counts,
      checkedAt: this.checkedAt || null,
    };
  }

  static startMonitor() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => this.checkOnce(), 30 * 1000).unref?.();
  }
}
