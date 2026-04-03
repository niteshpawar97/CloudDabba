import { Response, NextFunction } from 'express';
import os from 'os';
import { DomainService } from '../../core/services/domain.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import prisma from '../../database/connection';

function getServerIP(): string {
  if (process.env.SERVER_IP) return process.env.SERVER_IP;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('10.') && !iface.address.startsWith('172.') && !iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '0.0.0.0';
}

export class DomainController {
  static async setDomain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DomainService.setCustomDomain(
        req.params.id as string,
        req.user!.id,
        req.body.customDomain
      );
      sendSuccess(res, result, result.verified ? 'Domain verified and active!' : 'Domain set — configure DNS to verify');
    } catch (error) {
      next(error);
    }
  }

  static async verifyDomain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DomainService.reverifyDomain(req.params.id as string, req.user!.id);
      sendSuccess(res, result, result.verified ? 'Domain verified!' : 'DNS not yet pointing to CloudDabba');
    } catch (error) {
      next(error);
    }
  }

  static async removeDomain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DomainService.removeCustomDomain(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Custom domain removed');
    } catch (error) {
      next(error);
    }
  }

  static async getDomainStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const project = await prisma.project.findUnique({ where: { id: req.params.id as string } });
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      if (project.userId !== req.user!.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      const customDomain = (project as any).customDomain;
      const domainVerified = (project as any).domainVerified;

      if (!customDomain) {
        return sendSuccess(res, { customDomain: null, verified: false, instructions: null });
      }

      const baseDomain = process.env.BASE_DOMAIN || 'clouddabba.dev';
      const instructions = {
        cname: { type: 'CNAME', name: customDomain, value: `${project.subdomain}.${baseDomain}` },
        a: { type: 'A', name: customDomain, value: getServerIP() },
      };

      sendSuccess(res, { customDomain, verified: domainVerified, instructions });
    } catch (error) {
      next(error);
    }
  }
}
