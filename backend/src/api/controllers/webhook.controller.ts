import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../database/connection';
import { DeploymentService } from '../../core/services/deployment.service';
import logger from '../../shared/utils/logger';

export class WebhookController {
  /**
   * GitHub webhook handler — auto-deploys on push events.
   * POST /api/webhook/github/:projectId
   * No auth required — uses webhook secret for verification.
   */
  static async githubWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = req.params.projectId as string;
      const event = req.headers['x-github-event'] as string;

      // Only handle push events
      if (event !== 'push') {
        return res.json({ success: true, message: `Ignored event: ${event}` });
      }

      // Find project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { user: { select: { id: true } } },
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // Check auto-deploy is enabled
      if (!(project as any).autoDeploy) {
        return res.json({ success: true, message: 'Auto-deploy is disabled for this project' });
      }

      // Verify webhook secret
      const secret = (project as any).webhookSecret;
      if (secret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature) {
          return res.status(401).json({ success: false, message: 'Missing signature' });
        }

        const body = JSON.stringify(req.body);
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      }

      // Check if push is to the correct branch
      const pushBranch = req.body.ref?.replace('refs/heads/', '') || '';
      if (pushBranch !== project.branch) {
        return res.json({
          success: true,
          message: `Push to ${pushBranch}, skipping (watching ${project.branch})`,
        });
      }

      // Trigger deploy
      logger.info(`Webhook auto-deploy triggered for project ${project.name} (${projectId})`);
      const deployment = await DeploymentService.triggerDeploy(projectId, project.user.id);

      res.json({
        success: true,
        message: 'Deployment triggered',
        data: { deploymentId: deployment.id },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate/regenerate webhook secret for a project.
   * POST /api/projects/:id/webhook
   */
  static async enableWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = (req as any).params.id as string;
      const userId = (req as any).user?.id;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      if (project.userId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

      const secret = crypto.randomBytes(32).toString('hex');

      await prisma.project.update({
        where: { id: projectId },
        data: {
          autoDeploy: true,
          webhookSecret: secret,
        } as any,
      });

      const baseDomain = process.env.BASE_DOMAIN || 'localhost';
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const webhookUrl = `${protocol}://${baseDomain}/api/webhook/github/${projectId}`;

      res.json({
        success: true,
        data: {
          webhookUrl,
          secret,
          autoDeploy: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disable auto-deploy webhook.
   * DELETE /api/projects/:id/webhook
   */
  static async disableWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = (req as any).params.id as string;
      const userId = (req as any).user?.id;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      if (project.userId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          autoDeploy: false,
          webhookSecret: null,
        } as any,
      });

      res.json({ success: true, message: 'Auto-deploy disabled' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get webhook status for a project.
   * GET /api/projects/:id/webhook
   */
  static async getWebhookStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = (req as any).params.id as string;
      const userId = (req as any).user?.id;

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      if (project.userId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

      const autoDeploy = (project as any).autoDeploy || false;
      const hasSecret = !!(project as any).webhookSecret;

      const baseDomain = process.env.BASE_DOMAIN || 'localhost';
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const webhookUrl = autoDeploy ? `${protocol}://${baseDomain}/api/webhook/github/${projectId}` : null;

      res.json({
        success: true,
        data: {
          autoDeploy,
          webhookUrl,
          hasSecret,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
