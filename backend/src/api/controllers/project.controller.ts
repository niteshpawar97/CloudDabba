import { Response, NextFunction } from 'express';
import { ProjectService } from '../../core/services/project.service';
import { DeploymentService } from '../../core/services/deployment.service';
import { DockerService } from '../../core/services/docker.service';
import { NginxService } from '../../core/services/nginx.service';
import { DatabaseProvisionService } from '../../core/services/database-provision.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class ProjectController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await ProjectService.create(req.user!.id, req.body);
      sendCreated(res, project, 'Project created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const projects = await ProjectService.listByUser(req.user!.id);
      sendSuccess(res, projects);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await ProjectService.getById(req.params.id as string, req.user!.id);
      sendSuccess(res, project);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await ProjectService.update(req.params.id as string, req.user!.id, req.body);
      sendSuccess(res, project, 'Project updated');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Cleanup containers BEFORE deleting from DB (cascade deletes deployments)
      const deployments = await DeploymentService.listByProject(req.params.id as string, req.user!.id).catch(() => []);
      for (const dep of deployments as any[]) {
        if (dep.containerId) {
          await DockerService.stopContainer(dep.containerId).catch(() => {});
        }
      }

      // Cleanup provisioned databases
      const projData = await ProjectService.getById(req.params.id as string, req.user!.id).catch(() => null);
      if (projData && (projData as any).dbEnabled) {
        await DatabaseProvisionService.dropProjectDatabase(projData as any).catch(() => {});
      }
      if (projData && (projData as any).mariadbEnabled) {
        await DatabaseProvisionService.dropMariadb(projData as any).catch(() => {});
      }

      const project = await ProjectService.delete(req.params.id as string, req.user!.id);
      await NginxService.removeConfig(project.subdomain).catch(() => {});

      sendSuccess(res, null, 'Project deleted');
    } catch (error) {
      next(error);
    }
  }

  static async updateEnvVars(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await ProjectService.updateEnvVars(req.params.id as string, req.user!.id, req.body.envVars);
      sendSuccess(res, project, 'Environment variables updated');
    } catch (error) {
      next(error);
    }
  }

  static async updateSubdomain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { subdomain } = req.body;
      const project = await ProjectService.updateSubdomain(req.params.id as string, req.user!.id, subdomain);
      sendSuccess(res, project, 'Subdomain updated');
    } catch (error) {
      next(error);
    }
  }

  static async transferOwnership(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const project = await ProjectService.transferOwnership(req.params.id as string, req.user!.id, email);
      sendSuccess(res, project, 'Project ownership transferred');
    } catch (error) {
      next(error);
    }
  }

  static async checkSubdomain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const available = await ProjectService.checkSubdomain(req.params.subdomain as string);
      sendSuccess(res, { available, subdomain: req.params.subdomain });
    } catch (error) {
      next(error);
    }
  }
}
