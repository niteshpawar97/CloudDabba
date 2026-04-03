import { Response, NextFunction } from 'express';
import { DeploymentService } from '../../core/services/deployment.service';
import { LogService } from '../../core/services/log.service';
import { DockerService } from '../../core/services/docker.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class DeploymentController {
  static async triggerDeploy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await DeploymentService.triggerDeploy(req.params.id as string, req.user!.id);
      sendCreated(res, deployment, 'Deployment triggered');
    } catch (error) {
      next(error);
    }
  }

  static async listByProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deployments = await DeploymentService.listByProject(req.params.id as string, req.user!.id);
      sendSuccess(res, deployments);
    } catch (error) {
      next(error);
    }
  }

  static async getDeployment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await DeploymentService.getDeployment(req.params.id as string, req.user!.id);
      sendSuccess(res, deployment);
    } catch (error) {
      next(error);
    }
  }

  static async stopDeployment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DeploymentService.stopDeployment(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Deployment stopped');
    } catch (error) {
      next(error);
    }
  }

  static async startDeployment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DeploymentService.startDeployment(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Deployment started');
    } catch (error) {
      next(error);
    }
  }

  static async restartDeployment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DeploymentService.restartDeployment(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Deployment restarted');
    } catch (error) {
      next(error);
    }
  }

  static async getLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DeploymentService.getDeployment(req.params.id as string, req.user!.id);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const result = await LogService.getLogs(req.params.id as string, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getContainerStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await DeploymentService.getDeployment(req.params.id as string, req.user!.id);
      if (!deployment.containerId) {
        return sendSuccess(res, { cpu: 0, memory: { usage: 0, limit: 0, percent: 0 } });
      }
      const stats = await DockerService.getContainerStats(deployment.containerId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  static async getContainerLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await DeploymentService.getDeployment(req.params.id as string, req.user!.id);
      if (!deployment.containerId) {
        return sendSuccess(res, { logs: '' }, 'No container found');
      }
      const tail = parseInt(req.query.tail as string) || 200;
      const logs = await DockerService.getContainerLogs(deployment.containerId, tail);
      sendSuccess(res, { logs });
    } catch (error) {
      next(error);
    }
  }
}
