import prisma from '../../database/connection';

// A deployment row stuck in a non-terminal state (crashed process) must not
// block cleanup forever, so DB rows older than this are ignored.
const STALE_DB_MS = 2 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['QUEUED', 'CLONING', 'BUILDING', 'DEPLOYING'] as const;

/**
 * Coordinates deployments/builds with storage cleanup.
 *  - Deployments hold a counted lock for their whole pipeline.
 *  - Cleanup takes an exclusive "cleaning" flag; deployments wait for it
 *    to finish before starting, so a build never races a prune.
 * CloudDabba runs as a single process (pm2 instances: 1), so in-memory state
 * is authoritative; the DB check is a second safety net.
 */
export class DeployLockService {
  private static active = new Set<string>();
  private static cleaning: Promise<void> | null = null;
  private static releaseCleaning: (() => void) | null = null;

  /** Waits for any running cleanup, then registers an active deployment. */
  static async acquire(deploymentId: string): Promise<void> {
    while (this.cleaning) await this.cleaning;
    this.active.add(deploymentId);
  }

  static release(deploymentId: string) {
    this.active.delete(deploymentId);
  }

  /** Returns a reason string if a deployment/build is in flight, else null. */
  static async busyReason(): Promise<string | null> {
    if (this.active.size > 0) return `${this.active.size} deployment(s) in progress`;
    try {
      const n = await prisma.deployment.count({
        where: {
          status: { in: ACTIVE_STATUSES as any },
          startedAt: { gt: new Date(Date.now() - STALE_DB_MS) },
        },
      });
      if (n > 0) return `${n} deployment(s) in progress`;
    } catch {
      // If we can't verify, fail safe: treat as busy.
      return 'unable to verify deployment state';
    }
    return null;
  }

  /**
   * Try to begin a cleanup. Returns a release fn, or null (with reason) when
   * a deployment is active or another cleanup is already running.
   */
  static async tryBeginCleanup(): Promise<{ release: () => void } | { reason: string }> {
    if (this.cleaning) return { reason: 'another cleanup is already running' };
    const busy = await this.busyReason();
    if (busy) return { reason: busy };
    if (this.cleaning) return { reason: 'another cleanup is already running' };
    this.cleaning = new Promise<void>((r) => { this.releaseCleaning = r; });
    return {
      release: () => {
        const r = this.releaseCleaning;
        this.cleaning = null;
        this.releaseCleaning = null;
        r?.();
      },
    };
  }

  static isCleaning() {
    return this.cleaning !== null;
  }
}
