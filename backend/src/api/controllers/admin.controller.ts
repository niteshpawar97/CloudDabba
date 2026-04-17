import { Response, NextFunction } from 'express';
import prisma from '../../database/connection';
import docker from '../../infrastructure/docker/docker-client';
import { AuthRequest, AppError } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import { DockerService } from '../../core/services/docker.service';
import { changelog } from '../../data/changelog';
import { DatabaseProvisionService } from '../../core/services/database-provision.service';
import logger from '../../shared/utils/logger';

export class AdminController {
  // Dashboard stats
  static async getStats(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [totalUsers, totalProjects, totalDeployments, liveDeployments, failedDeployments, provisionedDbs, provisionedRedis] = await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.deployment.count(),
        prisma.deployment.count({ where: { status: 'LIVE' as any } }),
        prisma.deployment.count({ where: { status: 'FAILED' as any } }),
        prisma.project.count({ where: { dbEnabled: true } as any }),
        prisma.project.count({ where: { redisEnabled: true } as any }),
      ]);

      // Docker stats
      let containers = 0;
      let images = 0;
      try {
        const containerList = await docker.listContainers({ all: true, filters: { label: ['clouddabba.managed=true'] } });
        containers = containerList.length;
        const imageList = await docker.listImages();
        images = imageList.filter((img: any) => img.RepoTags?.some((t: string) => t.startsWith('clouddabba/'))).length;
      } catch {}

      // Recent deployments for chart (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentDeployments = await prisma.deployment.findMany({
        where: { startedAt: { gte: sevenDaysAgo } },
        select: { startedAt: true, status: true },
        orderBy: { startedAt: 'asc' },
      });

      // Group by day
      const deploymentsByDay: Record<string, { date: string; total: number; success: number; failed: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        deploymentsByDay[key] = { date: key, total: 0, success: 0, failed: 0 };
      }
      for (const dep of recentDeployments) {
        const key = dep.startedAt.toISOString().split('T')[0];
        if (deploymentsByDay[key]) {
          deploymentsByDay[key].total++;
          if (dep.status === 'LIVE') deploymentsByDay[key].success++;
          if (dep.status === 'FAILED') deploymentsByDay[key].failed++;
        }
      }

      sendSuccess(res, {
        stats: {
          totalUsers,
          totalProjects,
          totalDeployments,
          liveDeployments,
          failedDeployments,
          containers,
          images,
          provisionedDbs,
          provisionedRedis,
        },
        chartData: Object.values(deploymentsByDay),
      });
    } catch (error) {
      next(error);
    }
  }

  // List all users
  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        (prisma.user.findMany as any)({
          where,
          select: {
            id: true, name: true, email: true, role: true, createdAt: true,
            githubPatEncrypted: true,
            _count: { select: { projects: true } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      const formatted = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        hasPAT: !!u.githubPatEncrypted,
        projectCount: u._count.projects,
        createdAt: u.createdAt,
      }));

      sendSuccess(res, { users: formatted, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      next(error);
    }
  }

  // Update user role
  static async updateUserRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { role } = req.body;
      if (!['user', 'admin'].includes(role)) {
        throw new AppError('Invalid role', 400);
      }
      const user = await (prisma.user.update as any)({
        where: { id: req.params.id as string },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });
      sendSuccess(res, user, 'User role updated');
    } catch (error) {
      next(error);
    }
  }

  // Delete user
  static async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.params.id === req.user!.id) {
        throw new AppError('Cannot delete yourself', 400);
      }
      await prisma.user.delete({ where: { id: req.params.id as string } });
      sendSuccess(res, null, 'User deleted');
    } catch (error) {
      next(error);
    }
  }

  // List all projects (all users)
  static async listAllProjects(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          include: {
            user: { select: { name: true, email: true } },
            deployments: { take: 1, orderBy: { startedAt: 'desc' } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.project.count(),
      ]);

      sendSuccess(res, { projects, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      next(error);
    }
  }

  // List all deployments
  static async listAllDeployments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const where: any = {};
      if (status) where.status = status;

      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({
          where,
          include: {
            project: { select: { name: true, subdomain: true, user: { select: { name: true } } } },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startedAt: 'desc' },
        }),
        prisma.deployment.count({ where }),
      ]);

      sendSuccess(res, { deployments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      next(error);
    }
  }

  // Docker containers list
  static async listContainers(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const containers = await docker.listContainers({ all: true, filters: { label: ['clouddabba.managed=true'] } });
      const formatted = containers.map((c: any) => ({
        id: c.Id.slice(0, 12),
        name: c.Names[0]?.replace('/', ''),
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: c.Ports?.map((p: any) => `${p.PublicPort || ''}:${p.PrivatePort}`).filter(Boolean),
        created: new Date(c.Created * 1000).toISOString(),
      }));
      sendSuccess(res, formatted);
    } catch (error) {
      next(error);
    }
  }

  // Stop container
  static async stopContainer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DockerService.stopContainer(req.params.id as string);
      sendSuccess(res, null, 'Container stopped');
    } catch (error) {
      next(error);
    }
  }

  // Remove exited container
  static async removeContainer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const container = docker.getContainer(req.params.id as string);
      await container.remove({ force: true });
      sendSuccess(res, null, 'Container removed');
    } catch (error) {
      next(error);
    }
  }

  // Remove all exited containers
  static async cleanupContainers(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: ['clouddabba.managed=true'], status: ['exited'] },
      });
      let removed = 0;
      for (const c of containers) {
        try {
          const container = docker.getContainer(c.Id);
          await container.remove({ force: true });
          removed++;
        } catch {}
      }
      sendSuccess(res, { removed }, `Removed ${removed} exited containers`);
    } catch (error) {
      next(error);
    }
  }

  // Recent activity
  static async getActivity(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const recentDeployments = await prisma.deployment.findMany({
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: {
          project: { select: { name: true, subdomain: true, user: { select: { name: true } } } },
        },
      });

      const activity = recentDeployments.map((d) => ({
        id: d.id,
        type: 'deployment',
        status: d.status,
        project: d.project.name,
        subdomain: d.project.subdomain,
        user: d.project.user.name,
        timestamp: d.startedAt,
      }));

      sendSuccess(res, activity);
    } catch (error) {
      next(error);
    }
  }

  // Platform settings
  static async getSettings(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { config } = require('../../shared/config/app.config');
      const prismaClient = require('../../database/connection').default;
      const row = await prismaClient.platformSettings.findUnique({ where: { id: 'singleton' } });

      const editable = {
        platformName: row?.platformName ?? 'CloudDabba',
        baseDomain: row?.baseDomain ?? config.domain.base ?? '',
        adminEmail: row?.adminEmail ?? config.domain.adminEmail ?? '',
        sslEmail: row?.sslEmail ?? '',
        corsOrigins: row?.corsOrigins ?? (config.cors.origin || []).join(','),
        allowSignup: row?.allowSignup ?? true,
        defaultBranch: row?.defaultBranch ?? 'main',
      };

      const infrastructure = {
        port: config.app.port,
        environment: config.app.nodeEnv,
        portRange: `${config.ports.rangeStart}-${config.ports.rangeEnd}`,
        nginxSitesPath: config.nginx.sitesPath,
        dockerSocket: config.docker.socketPath,
      };

      sendSuccess(res, {
        editable,
        infrastructure,
        installedAt: row?.installedAt ?? null,
        sslEnabled: row?.sslEnabled ?? false,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const prismaClient = require('../../database/connection').default;
      const { platformName, baseDomain, adminEmail, sslEmail, corsOrigins, allowSignup, defaultBranch } = req.body;

      const data: any = {};
      if (typeof platformName === 'string') data.platformName = platformName.trim().slice(0, 100);
      if (typeof baseDomain === 'string') data.baseDomain = baseDomain.trim().slice(0, 255) || null;
      if (typeof adminEmail === 'string') data.adminEmail = adminEmail.trim().slice(0, 255) || null;
      if (typeof sslEmail === 'string') data.sslEmail = sslEmail.trim().slice(0, 255) || null;
      if (typeof corsOrigins === 'string') data.corsOrigins = corsOrigins.trim() || null;
      if (typeof allowSignup === 'boolean') data.allowSignup = allowSignup;
      if (typeof defaultBranch === 'string') data.defaultBranch = defaultBranch.trim().slice(0, 100) || 'main';

      const row = await prismaClient.platformSettings.upsert({
        where: { id: 'singleton' },
        update: data,
        create: { id: 'singleton', ...data },
      });

      const { SetupService } = require('../../core/services/setup.service');
      SetupService.invalidateCache();
      const { PlatformConfig } = require('../../core/services/platform-config.service');
      PlatformConfig.invalidate();

      sendSuccess(res, row, 'Settings updated');
    } catch (error) {
      next(error);
    }
  }

  static async restartServer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const logger = require('../../shared/utils/logger').default;
      logger.warn(`Server restart requested by admin ${req.user?.email || req.user?.id}`);
      sendSuccess(res, { scheduled: true, delayMs: 800 }, 'Server restarting — reconnecting in a few seconds');

      setTimeout(() => {
        logger.warn('Admin-initiated restart: exiting for PM2 auto-respawn');
        process.exit(0);
      }, 800);
    } catch (error) {
      next(error);
    }
  }

  // Docker images list
  static async listImages(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const images = await docker.listImages();
      const clouddabbaImages = images
        .filter((img: any) => img.RepoTags?.some((t: string) => t.startsWith('clouddabba/')))
        .map((img: any) => ({
          id: img.Id.replace('sha256:', '').slice(0, 12),
          tags: img.RepoTags,
          size: Math.round(img.Size / 1024 / 1024),
          created: new Date(img.Created * 1000).toISOString(),
        }));
      sendSuccess(res, clouddabbaImages);
    } catch (error) {
      next(error);
    }
  }

  // Delete Docker image
  static async deleteImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DockerService.removeImage(req.params.id as string);
      sendSuccess(res, null, 'Image removed');
    } catch (error) {
      next(error);
    }
  }

  // Cleanup all unused images
  static async cleanupImages(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const images = await docker.listImages();
      const containers = await docker.listContainers({ all: true });
      const usedImages = new Set(containers.map((c: any) => c.ImageID));

      let cleaned = 0;
      for (const img of images) {
        if (img.RepoTags?.some((t: string) => t.startsWith('clouddabba/')) && !usedImages.has(img.Id)) {
          try {
            await docker.getImage(img.Id).remove({ force: true });
            cleaned++;
          } catch {}
        }
      }

      sendSuccess(res, { cleaned }, `${cleaned} unused images removed`);
    } catch (error) {
      next(error);
    }
  }

  // Platform changelog
  static async getChangelog(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, changelog);
    } catch (error) {
      next(error);
    }
  }

  // Provisioned databases
  static async listDatabases(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const databases = await DatabaseProvisionService.listAllDatabases();
      sendSuccess(res, databases);
    } catch (error) {
      next(error);
    }
  }

  // Admin: force delete a project's postgres
  static async adminDeletePostgres(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await prisma.project.findUnique({ where: { id: req.params.id as string } });
      if (!project) throw new AppError('Project not found', 404);
      await DatabaseProvisionService.dropProjectDatabase(project as any);
      await prisma.project.update({ where: { id: req.params.id as string }, data: { dbEnabled: false, dbName: null, dbUser: null, dbPasswordEnc: null } as any });
      sendSuccess(res, null, 'PostgreSQL database deleted');
    } catch (error) {
      next(error);
    }
  }

  // Admin: force delete a project's mariadb
  static async adminDeleteMariadb(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await prisma.project.findUnique({ where: { id: req.params.id as string } });
      if (!project) throw new AppError('Project not found', 404);
      await DatabaseProvisionService.dropMariadb(project as any);
      await prisma.project.update({ where: { id: req.params.id as string }, data: { mariadbEnabled: false, mariadbName: null, mariadbUser: null, mariadbPasswordEnc: null } as any });
      sendSuccess(res, null, 'MariaDB database deleted');
    } catch (error) {
      next(error);
    }
  }

  // Admin: force delete a project's redis
  static async adminDeleteRedis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.project.update({ where: { id: req.params.id as string }, data: { redisEnabled: false, redisDbNumber: null } as any });
      sendSuccess(res, null, 'Redis database deleted');
    } catch (error) {
      next(error);
    }
  }
}
