import prisma from '../../database/connection';
import { AppError } from '../types';

// Reserved subdomains that can't be used
const RESERVED_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'mail', 'ftp', 'ns1', 'ns2', 'panel', 'dashboard', 'login', 'signup', 'auth'];

function sanitizeSubdomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 63);
}

function generateRandomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

export class ProjectService {
  static async create(userId: string, data: {
    name: string;
    repoUrl: string;
    branch?: string;
    projectType: string;
    subdomain?: string;
    envVars?: Record<string, string>;
  }) {
    let subdomain = sanitizeSubdomain(data.subdomain || data.name);

    // Check reserved
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      subdomain = `${subdomain}-${generateRandomSuffix()}`;
    }

    // Check availability, add random suffix if taken
    let existing = await prisma.project.findUnique({ where: { subdomain } });
    while (existing) {
      subdomain = `${sanitizeSubdomain(data.name)}-${generateRandomSuffix()}`;
      existing = await prisma.project.findUnique({ where: { subdomain } });
    }

    let project;
    try {
      project = await prisma.project.create({
        data: {
          userId,
          name: data.name,
          repoUrl: data.repoUrl,
          subdomain,
          branch: data.branch || 'main',
          projectType: data.projectType as any,
          envVars: data.envVars || undefined,
        },
        include: {
          deployments: {
            take: 1,
            orderBy: { startedAt: 'desc' },
          },
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError(`A project named "${data.name}" already exists`, 409);
      }
      throw err;
    }

    // ERPNext requires MariaDB + Redis to function. Provision both immediately
    // on project create so the user never lands in the "deploy → crash because
    // env vars are empty" trap.
    if (data.projectType === 'ERPNEXT') {
      const { DatabaseProvisionService } = await import('./database-provision.service');
      try {
        await DatabaseProvisionService.enableMariadb(project.id, userId);
      } catch (err: any) {
        // Already enabled or transient error — surface but don't undo project creation
        if (!String(err?.message || '').includes('already enabled')) {
          throw err;
        }
      }
      try {
        await DatabaseProvisionService.enableRedis(project.id, userId);
      } catch (err: any) {
        if (!String(err?.message || '').includes('already enabled')) {
          throw err;
        }
      }
      // Re-fetch so caller sees the provisioned db fields
      const refreshed = await prisma.project.findUnique({
        where: { id: project.id },
        include: { deployments: { take: 1, orderBy: { startedAt: 'desc' } } },
      });
      return refreshed || project;
    }

    return project;
  }

  static async listByUser(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      include: {
        deployments: {
          take: 1,
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async getById(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        deployments: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);
    return project;
  }

  static async update(projectId: string, userId: string, data: {
    name?: string;
    branch?: string;
    envVars?: Record<string, string>;
  }) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    return prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  static async delete(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { deployments: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    // Tear down docker-compose stack if this was a compose deployment
    const lastDeployment = project.deployments[0];
    if (lastDeployment?.containerId?.startsWith('compose:')) {
      const composeProjectName = lastDeployment.containerId.replace(/^compose:/, '');
      try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const exec = promisify(execFile);
        await exec('docker', ['compose', '-p', composeProjectName, 'down', '-v', '--remove-orphans'], { timeout: 60000 });
      } catch {
        // Non-fatal — orphaned containers can be cleaned up via docker admin tools
      }
    }

    await prisma.project.delete({ where: { id: projectId } });
    return project;
  }

  static async updateEnvVars(projectId: string, userId: string, envVars: Record<string, string>) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    return prisma.project.update({
      where: { id: projectId },
      data: { envVars },
    });
  }

  static async updateSubdomain(projectId: string, userId: string, newSubdomain: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const subdomain = sanitizeSubdomain(newSubdomain);
    if (!subdomain || subdomain.length < 3) {
      throw new AppError('Subdomain must be at least 3 characters', 400);
    }
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      throw new AppError('This subdomain is reserved', 400);
    }

    const existing = await prisma.project.findUnique({ where: { subdomain } });
    if (existing && existing.id !== projectId) {
      throw new AppError('This subdomain is already taken', 409);
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { subdomain },
    });
  }

  static async checkSubdomain(subdomain: string): Promise<boolean> {
    const sanitized = sanitizeSubdomain(subdomain);
    if (!sanitized || sanitized.length < 3 || RESERVED_SUBDOMAINS.includes(sanitized)) {
      return false;
    }
    const existing = await prisma.project.findUnique({ where: { subdomain: sanitized } });
    return !existing;
  }
}
