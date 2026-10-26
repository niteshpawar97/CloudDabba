import docker from '../../infrastructure/docker/docker-client';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';

/**
 * Keeps the images of the last RETAIN superseded deployments per project so they
 * can be restored in one click, and protects them from automatic storage cleanup.
 */

export const RETAIN = 2;

interface Retained { id: string; projectId: string; dockerImageId: string }

export class RollbackService {
  /** Superseded deployments (not live, image recorded, rollback-capable), newest first, per project. */
  private static async retained(projectId?: string): Promise<Retained[]> {
    const rows = await prisma.deployment.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: 'STOPPED' as any,
        dockerImageId: { not: null },
        internalPort: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, projectId: true, dockerImageId: true, containerId: true },
      take: projectId ? 50 : 2000,
    });
    const perProject = new Map<string, number>();
    const out: Retained[] = [];
    for (const r of rows) {
      if (r.containerId?.startsWith('compose:')) continue;
      const n = perProject.get(r.projectId) || 0;
      if (n >= RETAIN) continue;
      perProject.set(r.projectId, n + 1);
      out.push({ id: r.id, projectId: r.projectId, dockerImageId: r.dockerImageId! });
    }
    return out;
  }

  /** Image IDs that automatic cleanup must keep so rollback stays possible. */
  static async protectedImageIds(): Promise<Set<string>> {
    try {
      return new Set((await this.retained()).map((r) => r.dockerImageId));
    } catch (e: any) {
      logger.warn(`Rollback: could not list retained images: ${e.message}`);
      throw e; // callers treat failure as "unsafe to clean"
    }
  }

  static async imageExists(imageId: string): Promise<boolean> {
    try {
      await docker.getImage(imageId).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /** Remove images of superseded deployments beyond the retention window. */
  static async pruneOldImages(projectId: string) {
    const keep = new Set((await this.retained(projectId)).map((r) => r.dockerImageId));
    const live = await prisma.deployment.findMany({
      where: { projectId, status: { in: ['LIVE', 'DEPLOYING', 'BUILDING'] as any }, dockerImageId: { not: null } },
      select: { dockerImageId: true },
    });
    for (const l of live) keep.add(l.dockerImageId!);

    const old = await prisma.deployment.findMany({
      where: { projectId, dockerImageId: { not: null }, status: { in: ['STOPPED', 'FAILED'] as any } },
      select: { dockerImageId: true },
    });
    for (const d of new Set(old.map((o) => o.dockerImageId!))) {
      if (keep.has(d)) continue;
      try {
        await docker.getImage(d).remove({ force: false });
      } catch (e: any) {
        if (e.statusCode !== 404 && e.statusCode !== 409) logger.warn(`Rollback prune: ${d}: ${e.message}`);
      }
    }
  }

  /** Adds `canRollback` to deployment rows (one Docker call for the whole list). */
  static async annotate<T extends { id: string; projectId: string }>(projectId: string, deployments: T[]) {
    let ids = new Set<string>();
    let existing = new Set<string>();
    let containers = new Set<string>();
    try {
      ids = new Set((await this.retained(projectId)).map((r) => r.id));
      if (ids.size) {
        existing = new Set(((await docker.listImages()) as any[]).map((i) => i.Id));
        containers = new Set(((await docker.listContainers({ all: true })) as any[]).map((c) => c.Id));
      }
    } catch { /* leave everything non-rollbackable */ }
    // A deployment whose container still exists was only stopped by the user (use Start), not superseded.
    const hasContainer = (id?: string | null) => !!id && [...containers].some((c) => c === id || c.startsWith(id));
    return deployments.map((d: any) => ({
      ...d,
      canRollback: ids.has(d.id) && !!d.dockerImageId && existing.has(d.dockerImageId) && !hasContainer(d.containerId),
    }));
  }
}
