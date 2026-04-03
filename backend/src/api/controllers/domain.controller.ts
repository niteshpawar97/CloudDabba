import { Response, NextFunction } from 'express';
import { DomainService } from '../../core/services/domain.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import prisma from '../../database/connection';

let cachedIP: string | null = null;
async function getServerIP(): Promise<string> {
  if (process.env.SERVER_IP) return process.env.SERVER_IP;
  if (cachedIP) return cachedIP;
  try {
    const res = await fetch('https://api.ipify.org?format=text', { signal: AbortSignal.timeout(3000) });
    if (res.ok) { cachedIP = (await res.text()).trim(); return cachedIP; }
  } catch {}
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
      const serverIP = await getServerIP();
      const instructions = {
        cname: { type: 'CNAME', name: customDomain, value: `${project.subdomain}.${baseDomain}` },
        a: { type: 'A', name: customDomain, value: serverIP },
      };

      sendSuccess(res, { customDomain, verified: domainVerified, instructions });
    } catch (error) {
      next(error);
    }
  }
}
