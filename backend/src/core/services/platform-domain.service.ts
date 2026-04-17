import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { DomainDiagnosticsService } from './domain-diagnostics.service';
import { PlatformConfig } from './platform-config.service';

const execFileAsync = promisify(execFile);

export interface DomainChangeStep {
  name: string;
  ok: boolean;
  detail?: string;
  skipped?: boolean;
}

export interface DomainChangeResult {
  ok: boolean;
  steps: DomainChangeStep[];
  domain: string;
  panelUrl?: string;
  error?: string;
}

const NGINX_TEMPLATE = `events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50m;

    # CloudDabba Platform
    server {
        listen 80;
        server_name __DOMAIN__ *.__DOMAIN__;

        location / {
            proxy_pass http://127.0.0.1:6050;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://127.0.0.1:6050;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # Auto-generated per-project subdomain configs
    include /etc/nginx/sites-enabled/cd-*.conf;
}
`;

async function sudoWriteFile(dest: string, content: string) {
  const tmp = path.join(os.tmpdir(), `nginx-${Date.now()}.conf`);
  await fs.writeFile(tmp, content, 'utf-8');
  await execFileAsync('sudo', ['cp', tmp, dest], { timeout: 10000 });
  await fs.unlink(tmp).catch(() => {});
}

export class PlatformDomainService {
  static async changeDomain(opts: {
    domain: string;
    sslEmail?: string;
    skipDns?: boolean;
    skipSsl?: boolean;
  }): Promise<DomainChangeResult> {
    const steps: DomainChangeStep[] = [];
    const domain = (opts.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!domain || !domain.includes('.')) {
      return { ok: false, steps, domain, error: 'Invalid domain' };
    }

    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(domain);

    // Step 1: DNS check
    if (!opts.skipDns && !isIp) {
      try {
        const dns = await DomainDiagnosticsService.testDns(domain);
        if (!dns.apex?.matches) {
          steps.push({
            name: 'DNS verification',
            ok: false,
            detail: `Apex ${domain} does not point to this server (resolved: ${dns.apex?.resolved?.join(', ') || 'none'}, expected: ${dns.serverIp})`,
          });
          return { ok: false, steps, domain, error: 'DNS not pointing here. Add A record and retry, or skip DNS check.' };
        }
        const wildcardOk = dns.wildcard?.matches;
        steps.push({
          name: 'DNS verification',
          ok: true,
          detail: `Apex ✓${wildcardOk ? ' · Wildcard ✓' : ' · Wildcard missing (deployed apps won\'t get subdomains until you add A *)'}`,
        });
      } catch (e: any) {
        steps.push({ name: 'DNS verification', ok: false, detail: e.message });
        return { ok: false, steps, domain, error: 'DNS check failed' };
      }
    } else {
      steps.push({ name: 'DNS verification', ok: true, skipped: true, detail: isIp ? 'IP address — skipped' : 'Skipped by user' });
    }

    // Step 2: Update DB (baseDomain, sslEmail, CORS origins)
    try {
      const existing = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
      const prevBase = existing?.baseDomain || '';
      const existingOrigins: string[] = (existing?.corsOrigins || '').split(',').map((s: string) => s.trim()).filter(Boolean);

      // Drop stale entries for previous base domain / IP, then add new http+https variants
      const kept = existingOrigins.filter((o) => !prevBase || !o.includes(prevBase));
      const newOrigins = Array.from(new Set([...kept, `http://${domain}`, `https://${domain}`]));

      await (prisma as any).platformSettings.upsert({
        where: { id: 'singleton' },
        update: {
          baseDomain: domain,
          corsOrigins: newOrigins.join(','),
          ...(opts.sslEmail ? { sslEmail: opts.sslEmail } : {}),
        },
        create: {
          id: 'singleton',
          baseDomain: domain,
          corsOrigins: newOrigins.join(','),
          ...(opts.sslEmail ? { sslEmail: opts.sslEmail } : {}),
        },
      });
      PlatformConfig.invalidate();
      steps.push({
        name: 'Database update',
        ok: true,
        detail: `baseDomain + CORS origins updated (${newOrigins.length} allowed)`,
      });
    } catch (e: any) {
      steps.push({ name: 'Database update', ok: false, detail: e.message });
      return { ok: false, steps, domain, error: 'Failed to save domain to database' };
    }

    // Step 3: Regenerate NGINX platform config (with backup)
    const nginxConf = '/etc/nginx/nginx.conf';
    const backup = `/tmp/nginx.conf.cd-backup-${Date.now()}`;
    try {
      await execFileAsync('sudo', ['cp', nginxConf, backup], { timeout: 5000 });
      const content = NGINX_TEMPLATE.replace(/__DOMAIN__/g, domain);
      await sudoWriteFile(nginxConf, content);
      steps.push({ name: 'NGINX config written', ok: true, detail: `${nginxConf} backed up to ${backup}` });
    } catch (e: any) {
      steps.push({ name: 'NGINX config written', ok: false, detail: e.message });
      return { ok: false, steps, domain, error: 'Failed to write NGINX config. Backend may lack sudo permission for cp.' };
    }

    // Step 4: Validate NGINX
    try {
      await execFileAsync('sudo', ['nginx', '-t'], { timeout: 10000 });
      steps.push({ name: 'NGINX validated', ok: true });
    } catch (e: any) {
      // Rollback
      try {
        await execFileAsync('sudo', ['cp', backup, nginxConf], { timeout: 5000 });
        await execFileAsync('sudo', ['nginx', '-s', 'reload'], { timeout: 10000 });
      } catch {}
      steps.push({
        name: 'NGINX validated',
        ok: false,
        detail: `Config test failed, rolled back. ${(e.stderr || e.message || '').toString().slice(0, 500)}`,
      });
      return { ok: false, steps, domain, error: 'NGINX config invalid — rolled back to previous.' };
    }

    // Step 5: Reload NGINX
    try {
      await execFileAsync('sudo', ['nginx', '-s', 'reload'], { timeout: 10000 });
      steps.push({ name: 'NGINX reloaded', ok: true });
    } catch (e: any) {
      steps.push({ name: 'NGINX reloaded', ok: false, detail: e.message });
      return { ok: false, steps, domain, error: 'NGINX reload failed' };
    }

    // Step 6: SSL via certbot (HTTP-01, apex only — wildcard needs DNS-01)
    let panelUrl = `http://${domain}`;
    if (opts.skipSsl || isIp) {
      steps.push({ name: 'SSL certificate', ok: true, skipped: true, detail: isIp ? 'IP address — SSL not possible' : 'Skipped by user' });
    } else {
      const email = opts.sslEmail || (await PlatformConfig.getSslEmail()) || (await PlatformConfig.getAdminEmail());
      if (!email) {
        steps.push({ name: 'SSL certificate', ok: false, skipped: true, detail: 'No email set — configure SSL Email in settings and retry' });
      } else {
        try {
          await execFileAsync(
            'sudo',
            ['certbot', '--nginx', '-d', domain, '--non-interactive', '--agree-tos', '--redirect', '-m', email],
            { timeout: 120000 }
          );
          steps.push({ name: 'SSL certificate', ok: true, detail: `Issued for ${domain} (apex only — wildcard requires DNS-01)` });
          panelUrl = `https://${domain}`;
        } catch (e: any) {
          const msg = (e.stderr || e.message || '').toString().slice(0, 500);
          steps.push({
            name: 'SSL certificate',
            ok: false,
            detail: `Certbot failed (HTTP still works). ${msg}`,
          });
          // Not a hard failure — panel works on HTTP
        }
      }
    }

    logger.info(`Platform domain changed to ${domain}`);
    return { ok: true, steps, domain, panelUrl };
  }
}
