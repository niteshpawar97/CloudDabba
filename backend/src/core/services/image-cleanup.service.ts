import docker from '../../infrastructure/docker/docker-client';
import logger from '../../shared/utils/logger';

// Never touch images built more recently than this — a deploy in flight
// (image built, container not started yet) must not get swept up.
const DEFAULT_GRACE_MS = 60 * 60 * 1000;

export class ImageCleanupService {
  static async cleanupUnusedImages(graceMs = DEFAULT_GRACE_MS): Promise<number> {
    const images = await docker.listImages();
    const containers = await docker.listContainers({ all: true });
    const usedImageIds = new Set(containers.map((c: any) => c.ImageID));
    const cutoffSeconds = Date.now() / 1000 - graceMs / 1000;

    let cleaned = 0;
    for (const img of images as any[]) {
      const isOurs = img.RepoTags?.some((t: string) => t.startsWith('clouddabba/'));
      if (!isOurs || usedImageIds.has(img.Id) || img.Created > cutoffSeconds) continue;
      try {
        await docker.getImage(img.Id).remove({ force: true });
        cleaned++;
      } catch (err: any) {
        if (err.statusCode !== 404) logger.error(`Image cleanup: failed to remove ${img.Id}: ${err.message}`);
      }
    }
    return cleaned;
  }

  static startScheduler(intervalMs = 6 * 60 * 60 * 1000) {
    const run = () => {
      this.cleanupUnusedImages()
        .then((cleaned) => {
          if (cleaned > 0) logger.info(`Automatic image cleanup: removed ${cleaned} unused image(s)`);
        })
        .catch((err) => logger.error('Automatic image cleanup failed:', err));
    };
    setInterval(run, intervalMs);
    setTimeout(run, 5 * 60 * 1000);
  }
}
