import docker from '../../infrastructure/docker/docker-client';
import fs from 'fs/promises';
import path from 'path';
import tar from 'tar-fs';
import { LogService } from './log.service';
import logger from '../../shared/utils/logger';

export class DockerService {
  static async buildImage(
    contextPath: string,
    tag: string,
    deploymentId: string,
    buildArgs?: Record<string, string>
  ): Promise<string> {
    const tarStream = tar.pack(contextPath);

    const buildOpts: any = { t: tag };
    if (buildArgs) {
      buildOpts.buildargs = buildArgs;
    }
    const stream = await docker.buildImage(tarStream as any, buildOpts);

    return new Promise((resolve, reject) => {
      let buildError: string | null = null;

      docker.modem.followProgress(
        stream as any,
        (err: any, output: any[]) => {
          if (err) {
            LogService.createLog(deploymentId, 'BUILD', `Build error: ${err.message}`);
            return reject(err);
          }

          // Check if any step had an error
          if (buildError) {
            return reject(new Error(`Docker build failed: ${buildError}`));
          }

          // Check output for error messages
          const errorOutput = output.find((o) => o.error);
          if (errorOutput) {
            return reject(new Error(`Docker build failed: ${errorOutput.error}`));
          }

          // Get image ID from last output
          const lastOutput = output.find((o) => o.aux?.ID);
          const imageId = lastOutput?.aux?.ID || tag;
          resolve(imageId);
        },
        (event: any) => {
          if (event.stream) {
            const msg = event.stream.trim();
            if (msg) {
              LogService.streamLog(deploymentId, 'BUILD', msg);
            }
          }
          if (event.error) {
            buildError = event.error;
            LogService.createLog(deploymentId, 'BUILD', `Error: ${event.error}`);
          }
          if (event.errorDetail) {
            buildError = event.errorDetail.message || event.error;
          }
        }
      );
    });
  }

  static async createAndStartContainer(
    imageTag: string,
    containerName: string,
    hostPort: number,
    containerPort: number,
    envVars: Record<string, string> = {},
    labels: Record<string, string> = {}
  ) {
    const envArray = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

    const container = await docker.createContainer({
      Image: imageTag,
      name: containerName,
      Env: envArray,
      ExposedPorts: { [`${containerPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: String(hostPort) }],
        },
        Memory: 512 * 1024 * 1024, // 512MB
        NanoCpus: 500000000,        // 0.5 CPU
        RestartPolicy: { Name: 'unless-stopped', MaximumRetryCount: 0 },
      },
      Labels: {
        'clouddabba.managed': 'true',
        ...labels,
      },
    });

    await container.start();

    // Connect to clouddabba network (for database/redis access)
    try {
      const network = docker.getNetwork('clouddabba');
      await network.connect({ Container: container.id });
    } catch {
      // Network may not exist in standalone mode — non-fatal
    }

    logger.info(`Container ${containerName} started on port ${hostPort}`);
    return container;
  }

  static async stopOnly(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      await container.stop({ t: 10 });
      logger.info(`Container ${containerId} stopped`);
    } catch (error: any) {
      if (error.statusCode !== 304 && error.statusCode !== 404) {
        logger.error(`Failed to stop container ${containerId}:`, error);
      }
    }
  }

  static async startContainer(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      await container.start();
      logger.info(`Container ${containerId} started`);
    } catch (error: any) {
      if (error.statusCode !== 304) {
        logger.error(`Failed to start container ${containerId}:`, error);
        throw error;
      }
    }
  }

  static async restartContainer(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      await container.restart({ t: 10 });
      logger.info(`Container ${containerId} restarted`);
    } catch (error: any) {
      logger.error(`Failed to restart container ${containerId}:`, error);
      throw error;
    }
  }

  static async stopContainer(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      await container.stop({ t: 10 });
      await container.remove({ force: true });
      logger.info(`Container ${containerId} stopped and removed`);
    } catch (error: any) {
      if (error.statusCode !== 404) {
        logger.error(`Failed to stop container ${containerId}:`, error);
        throw error;
      }
    }
  }

  static async removeImage(imageId: string) {
    try {
      const image = docker.getImage(imageId);
      await image.remove({ force: true });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        logger.error(`Failed to remove image ${imageId}:`, error);
      }
    }
  }

  static async copyDockerfile(repoPath: string, projectType: string) {
    // Only copy if no Dockerfile exists
    try {
      await fs.access(path.join(repoPath, 'Dockerfile'));
      return; // Dockerfile already exists
    } catch {}

    let templateName: string;
    switch (projectType) {
      case 'NEXTJS_APP':
        templateName = 'nextjs.Dockerfile';
        break;
      case 'REACT_FRONTEND':
        templateName = 'react.Dockerfile';
        break;
      case 'STATIC_SITE':
        templateName = 'static.Dockerfile';
        break;
      case 'FULLSTACK':
        templateName = 'fullstack.Dockerfile';
        break;
      case 'NODE_BACKEND':
      default:
        templateName = 'node.Dockerfile';
        break;
    }

    // Use src path (works in both dev and prod)
    const srcTemplates = path.join(__dirname, '../../infrastructure/docker/templates');
    const rootTemplates = path.resolve(process.cwd(), 'src/infrastructure/docker/templates');
    const templatesDir = await fs.access(srcTemplates).then(() => srcTemplates).catch(() => rootTemplates);

    const destPath = path.join(repoPath, 'Dockerfile');
    await fs.copyFile(path.join(templatesDir, templateName), destPath);
    logger.info(`Copied ${templateName} to ${repoPath}`);

    // Copy supporting files for fullstack (nginx config + start script)
    if (projectType === 'FULLSTACK') {
      await fs.copyFile(path.join(templatesDir, 'fullstack-nginx.conf'), path.join(repoPath, 'fullstack-nginx.conf'));
      await fs.copyFile(path.join(templatesDir, 'fullstack-start.sh'), path.join(repoPath, 'fullstack-start.sh'));
      logger.info('Copied fullstack support files (nginx.conf, start.sh)');
    }
  }

  static async getContainerStats(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
      const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;
      const memUsage = stats.memory_stats.usage || 0;
      const memLimit = stats.memory_stats.limit || 1;
      const memPercent = (memUsage / memLimit) * 100;
      return {
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: {
          usage: memUsage,
          limit: memLimit,
          percent: Math.round(memPercent * 100) / 100,
        },
      };
    } catch (error: any) {
      logger.error(`Failed to get stats for ${containerId}:`, error);
      return { cpu: 0, memory: { usage: 0, limit: 0, percent: 0 } };
    }
  }

  static async getContainerLogs(containerId: string, tail = 200): Promise<string> {
    try {
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logs.toString('utf8');
    } catch (error: any) {
      logger.error(`Failed to get container logs for ${containerId}:`, error);
      throw error;
    }
  }

  static async streamContainerLogs(
    containerId: string,
    onLog: (line: string) => void,
    onError: (err: Error) => void
  ): Promise<() => void> {
    const container = docker.getContainer(containerId);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 100,
      timestamps: true,
    });

    let destroyed = false;

    const readable = stream as NodeJS.ReadableStream;
    readable.on('data', (chunk: Buffer) => {
      if (destroyed) return;
      const lines = chunk.toString('utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        // Docker multiplexed stream: first 8 bytes are header, skip them
        const cleaned = line.length > 8 ? line.slice(8).trim() || line.trim() : line.trim();
        if (cleaned) onLog(cleaned);
      }
    });

    readable.on('error', (err: Error) => {
      if (!destroyed) onError(err);
    });

    readable.on('end', () => {
      destroyed = true;
    });

    return () => {
      destroyed = true;
      try {
        (readable as any).destroy?.();
      } catch {}
    };
  }

  static getContainerPort(projectType: string): number {
    switch (projectType) {
      case 'REACT_FRONTEND':
      case 'STATIC_SITE':
        return 80;
      case 'NEXTJS_APP':
        return 3000;
      default:
        return 3000;
    }
  }
}
