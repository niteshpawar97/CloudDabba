import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import prisma from '../../database/connection';
// DeploymentStatus values: QUEUED, CLONING, BUILDING, DEPLOYING, LIVE, FAILED, STOPPED
import { AuthService } from './auth.service';
import { GitHubService } from './github.service';
import { DockerService } from './docker.service';
import { NginxService } from './nginx.service';
import { LogService } from './log.service';
import { allocatePort } from '../../shared/utils/port-allocator';
import { broadcastStatus } from '../../infrastructure/websocket/log-stream';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

export class DeploymentService {
  static async triggerDeploy(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        status: 'QUEUED',
      },
    });

    // Run deploy pipeline async
    this.runPipeline(deployment.id, project.id, userId).catch((err) => {
      logger.error(`Deploy pipeline failed for ${deployment.id}:`, err);
    });

    return deployment;
  }

  private static async runPipeline(deploymentId: string, projectId: string, userId: string) {
    const buildDir = path.join(os.tmpdir(), 'clouddabba', 'builds', deploymentId);
    let containerId: string | undefined;
    let imageTag: string | undefined;

    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error('Project not found');

      // Step 1: Clone
      await this.updateStatus(deploymentId, 'CLONING');
      await LogService.createLog(deploymentId, 'SYSTEM', `Cloning repository: ${project.repoUrl} (branch: ${project.branch})`);

      let pat = '';
      try {
        pat = await AuthService.getDecryptedPAT(userId);
      } catch {
        // No PAT — clone as public repo
      }
      const commitHash = await GitHubService.cloneRepo(pat, project.repoUrl, project.branch, buildDir);

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { commitHash },
      });
      await LogService.createLog(deploymentId, 'SYSTEM', `Cloned at commit: ${commitHash}`);

      // Step 2: Detect & prepare
      await this.updateStatus(deploymentId, 'BUILDING');
      const detection = await GitHubService.detectProjectType(buildDir);
      const detectedType = detection.type;
      await LogService.createLog(deploymentId, 'SYSTEM', `Detected project type: ${detectedType} (${detection.reason})`);

      // Use project's stored type if manually set, otherwise use detected
      const buildType = project.projectType || detectedType;
      await DockerService.copyDockerfile(buildDir, buildType);

      // Prepare build args for fullstack projects
      const buildArgs: Record<string, string> = {};
      const projectConfig = project.envVars as any;
      if (buildType === 'FULLSTACK') {
        buildArgs.BACKEND_PATH = projectConfig?.backendPath || 'backend';
        buildArgs.FRONTEND_PATH = projectConfig?.frontendPath || 'frontend';
        await LogService.createLog(deploymentId, 'BUILD', `Fullstack: backend=/${buildArgs.BACKEND_PATH}, frontend=/${buildArgs.FRONTEND_PATH}`);
      }

      // Step 3: Build Docker image
      imageTag = `clouddabba/${project.subdomain}:${deploymentId.slice(0, 8)}`;
      await LogService.createLog(deploymentId, 'BUILD', `Building Docker image: ${imageTag}`);

      const imageId = await DockerService.buildImage(buildDir, imageTag, deploymentId, Object.keys(buildArgs).length > 0 ? buildArgs : undefined);
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { dockerImageId: imageId },
      });
      await LogService.createLog(deploymentId, 'BUILD', 'Docker image built successfully');

      // Step 4: Run container
      await this.updateStatus(deploymentId, 'DEPLOYING');
      const hostPort = await allocatePort();
      const containerPort = DockerService.getContainerPort(buildType);
      const containerName = `cd-${project.subdomain}-${deploymentId.slice(0, 8)}`;

      // Parse env vars — force PORT to match our container port
      const envVars: Record<string, string> = project.envVars ? { ...(project.envVars as Record<string, string>) } : {};
      envVars['PORT'] = String(containerPort);
      delete envVars['port'];

      const container = await DockerService.createAndStartContainer(
        imageTag,
        containerName,
        hostPort,
        containerPort,
        envVars,
        {
          'clouddabba.project': projectId,
          'clouddabba.deployment': deploymentId,
        }
      );

      containerId = container.id;
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { containerId, containerPort: hostPort },
      });
      await LogService.createLog(deploymentId, 'SYSTEM', `Container started on port ${hostPort}`);

      // Step 5: Stop previous deployment containers
      const previousDeployments = await prisma.deployment.findMany({
        where: {
          projectId,
          status: 'LIVE',
          id: { not: deploymentId },
        },
      });

      for (const prev of previousDeployments) {
        if (prev.containerId) {
          await DockerService.stopContainer(prev.containerId);
          await prisma.deployment.update({
            where: { id: prev.id },
            data: { status: 'STOPPED', finishedAt: new Date() },
          });
        }
      }

      // Step 6: Configure NGINX
      await NginxService.generateConfig(project.subdomain, hostPort);
      await LogService.createLog(deploymentId, 'SYSTEM', `Subdomain configured: ${project.subdomain}.${process.env.BASE_DOMAIN}`);

      // Step 7: Mark as live
      await this.updateStatus(deploymentId, 'LIVE');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { finishedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'ACTIVE' },
      });

      await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment successful! App is live.');

    } catch (error: any) {
      logger.error(`Deployment ${deploymentId} failed:`, error);
      await LogService.createLog(deploymentId, 'SYSTEM', `Deployment failed: ${error.message}`);
      await this.updateStatus(deploymentId, 'FAILED');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { finishedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });

      // Cleanup on failure
      if (containerId) {
        await DockerService.stopContainer(containerId).catch(() => {});
      }
      if (imageTag) {
        await DockerService.removeImage(imageTag).catch(() => {});
      }
    } finally {
      // Cleanup build directory
      await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private static async updateStatus(deploymentId: string, status: string) {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: status as any },
    });
    broadcastStatus(deploymentId, status);
  }

  static async getDeployment(deploymentId: string, userId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: true },
    });
    if (!deployment) throw new AppError('Deployment not found', 404);
    if (deployment.project.userId !== userId) throw new AppError('Unauthorized', 403);
    return deployment;
  }

  static async listByProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    return prisma.deployment.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  static async stopDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);

    if (deployment.containerId) {
      await DockerService.stopContainer(deployment.containerId);
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'STOPPED', finishedAt: new Date() },
    });

    await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment stopped by user');
    broadcastStatus(deploymentId, 'STOPPED');
  }
}
