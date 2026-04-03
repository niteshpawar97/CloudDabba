import dns from 'dns/promises';
import os from 'os';
import prisma from '../../database/connection';
import { NginxService } from './nginx.service';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

let cachedPublicIP: string | null = null;

async function getServerIP(): Promise<string> {
  if (process.env.SERVER_IP) return process.env.SERVER_IP;
  if (cachedPublicIP) return cachedPublicIP;

  // Fetch public IP from external service (NAT-aware)
  try {
    const res = await fetch('https://api.ipify.org?format=text', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      cachedPublicIP = (await res.text()).trim();
      return cachedPublicIP;
    }
  } catch {}

  // Fallback: try another service
  try {
    const res = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      cachedPublicIP = (await res.text()).trim();
      return cachedPublicIP;
    }
  } catch {}

  return '0.0.0.0';
}

export class DomainService {
  /**
   * Verify DNS for custom domain.
   * User must point CNAME to subdomain.baseDomain or A record to server IP.
   */
  static async verifyDNS(customDomain: string, expectedSubdomain: string): Promise<{ verified: boolean; records: string[]; instructions: any }> {
    const baseDomain = process.env.BASE_DOMAIN || 'clouddabba.dev';
    const expectedCNAME = `${expectedSubdomain}.${baseDomain}`;
    const serverIP = await getServerIP();

    const instructions = {
      cname: { type: 'CNAME', name: customDomain, value: expectedCNAME },
      a: { type: 'A', name: customDomain, value: serverIP },
      www: customDomain.startsWith('www.')
        ? null
        : { type: 'CNAME', name: `www.${customDomain}`, value: expectedCNAME },
    };

    try {
      // Check CNAME records
      try {
        const cnameRecords = await dns.resolveCname(customDomain);
        if (cnameRecords.some((r) => r.toLowerCase() === expectedCNAME.toLowerCase())) {
          return { verified: true, records: cnameRecords, instructions };
        }
      } catch {}

      // Check A records — match server IP
      try {
        const aRecords = await dns.resolve4(customDomain);
        if (serverIP && aRecords.includes(serverIP)) {
          return { verified: true, records: aRecords, instructions };
        }
        // Even without SERVER_IP, if A records exist, try to verify
        if (aRecords.length > 0) {
          return { verified: false, records: aRecords, instructions };
        }
      } catch {}

      return { verified: false, records: [], instructions };
    } catch (error: any) {
      logger.error(`DNS verification failed for ${customDomain}: ${error.message}`);
      return { verified: false, records: [], instructions };
    }
  }

  /**
   * Set custom domain for a project.
   */
  static async setCustomDomain(projectId: string, userId: string, customDomain: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    // Normalize domain
    const domain = customDomain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

    if (!domain || !domain.includes('.') || domain.length > 255) {
      throw new AppError('Invalid domain', 400);
    }

    // Check if domain is already used
    const existing = await prisma.project.findFirst({
      where: { customDomain: domain, id: { not: projectId } } as any,
    });
    if (existing) throw new AppError('This domain is already used by another project', 409);

    // Verify DNS
    const verification = await this.verifyDNS(domain, project.subdomain);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        customDomain: domain,
        domainVerified: verification.verified,
      } as any,
    });

    // If verified, generate NGINX config
    if (verification.verified) {
      const liveDeploy = await prisma.deployment.findFirst({
        where: { projectId, status: 'LIVE' as any },
        orderBy: { startedAt: 'desc' },
      });
      if (liveDeploy?.containerPort) {
        await NginxService.generateCustomDomainConfig(domain, liveDeploy.containerPort);
      }
    }

    return {
      customDomain: domain,
      verified: verification.verified,
      records: verification.records,
      instructions: verification.instructions,
    };
  }

  /**
   * Re-verify DNS for a project's custom domain.
   */
  static async reverifyDomain(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const domain = (project as any).customDomain;
    if (!domain) throw new AppError('No custom domain set', 400);

    const verification = await this.verifyDNS(domain, project.subdomain);

    const wasVerified = (project as any).domainVerified;

    await prisma.project.update({
      where: { id: projectId },
      data: { domainVerified: verification.verified } as any,
    });

    // If just got verified, generate NGINX config
    if (verification.verified && !wasVerified) {
      const liveDeploy = await prisma.deployment.findFirst({
        where: { projectId, status: 'LIVE' as any },
        orderBy: { startedAt: 'desc' },
      });
      if (liveDeploy?.containerPort) {
        await NginxService.generateCustomDomainConfig(domain, liveDeploy.containerPort);
      }
    }

    return {
      customDomain: domain,
      verified: verification.verified,
      records: verification.records,
      instructions: verification.instructions,
    };
  }

  /**
   * Remove custom domain.
   */
  static async removeCustomDomain(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const domain = (project as any).customDomain;

    await prisma.project.update({
      where: { id: projectId },
      data: { customDomain: null, domainVerified: false } as any,
    });

    if (domain) {
      await NginxService.removeCustomDomainConfig(domain);
    }
  }
}
