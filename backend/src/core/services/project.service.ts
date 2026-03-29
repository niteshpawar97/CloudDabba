import prisma from '../../database/connection';
import { AppError } from '../types';

export class ProjectService {
  static async create(userId: string, data: {
    name: string;
    repoUrl: string;
    branch?: string;
    projectType: string;
    envVars?: Record<string, string>;
  }) {
    const subdomain = data.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 63);

    const existing = await prisma.project.findUnique({ where: { subdomain } });
    if (existing) {
      throw new AppError('A project with this subdomain already exists', 409);
    }

    return prisma.project.create({
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
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

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
}
