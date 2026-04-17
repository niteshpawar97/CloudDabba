import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { encrypt, decrypt } from './encryption.service';
import { PlatformConfig } from './platform-config.service';

const execFileAsync = promisify(execFile);
const CF_INI_PATH = '/etc/letsencrypt/cloudflare.ini';

export interface CloudflareStatus {
  tokenConfigured: boolean;
  pluginInstalled: boolean;
  iniExists: boolean;
}

export interface WildcardResult {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail?: string; skipped?: boolean }>;
  domain: string;
  error?: string;
}

async function sudoWrite(dest: string, content: string, mode = '600') {
  const tmp = path.join(os.tmpdir(), `cf-${Date.now()}.ini`);
  await fs.writeFile(tmp, content, 'utf-8');
  await execFileAsync('sudo', ['cp', tmp, dest], { timeout: 5000 });
  await execFileAsync('sudo', ['chmod', mode, dest], { timeout: 5000 });
  await execFileAsync('sudo', ['chown', 'root:root', dest], { timeout: 5000 }).catch(() => {});
  await fs.unlink(tmp).catch(() => {});
}

async function pluginInstalled(): Promise<boolean> {
  try {
    await execFileAsync('which', ['certbot'], { timeout: 3000 });
    const { stdout } = await execFileAsync('certbot', ['plugins'], { timeout: 10000 });
    return /dns-cloudflare/i.test(stdout);
  } catch {
    return false;
  }
}

export class CloudflareSslService {
  static async saveToken(token: string) {
    if (!token || token.length < 20) throw new Error('Invalid Cloudflare API token');
    const encrypted = encrypt(token.trim());
    await (prisma as any).platformSettings.upsert({
      where: { id: 'singleton' },
      update: { cloudflareApiTokenEnc: encrypted },
      create: { id: 'singleton', cloudflareApiTokenEnc: encrypted },
    });
    PlatformConfig.invalidate();
  }

  static async removeToken() {
    await (prisma as any).platformSettings.update({
      where: { id: 'singleton' },
      data: { cloudflareApiTokenEnc: null },
    });
    // Remove on-disk ini too
    try {
      await execFileAsync('sudo', ['rm', '-f', CF_INI_PATH], { timeout: 3000 });
    } catch {}
    PlatformConfig.invalidate();
  }

  static async getStatus(): Promise<CloudflareStatus> {
    const row = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
    const tokenConfigured = !!row?.cloudflareApiTokenEnc;
    const pluginOk = await pluginInstalled();
    let iniExists = false;
    try {
      await execFileAsync('sudo', ['test', '-f', CF_INI_PATH], { timeout: 3000 });
      iniExists = true;
    } catch {}
    return { tokenConfigured, pluginInstalled: pluginOk, iniExists };
  }

  static async installWildcard(opts: { domain: string; email?: string }): Promise<WildcardResult> {
    const steps: WildcardResult['steps'] = [];
    const domain = (opts.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (!domain || !domain.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      return { ok: false, steps, domain, error: 'A valid domain (not IP) is required' };
    }

    // Step 1: Load token
    let token: string;
    try {
      const row = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
      if (!row?.cloudflareApiTokenEnc) {
        return { ok: false, steps, domain, error: 'Cloudflare API token not configured. Save it first.' };
      }
      token = decrypt(row.cloudflareApiTokenEnc);
      steps.push({ name: 'Cloudflare token loaded', ok: true });
    } catch (e: any) {
      steps.push({ name: 'Cloudflare token loaded', ok: false, detail: e.message });
      return { ok: false, steps, domain, error: 'Could not decrypt token — re-save it in settings' };
    }

    // Step 2: Ensure plugin installed
    if (!(await pluginInstalled())) {
      try {
        await execFileAsync('sudo', ['apt-get', 'install', '-y', 'python3-certbot-dns-cloudflare'], { timeout: 180000 });
        steps.push({ name: 'Installed certbot-dns-cloudflare', ok: true });
      } catch (e: any) {
        steps.push({
          name: 'Installed certbot-dns-cloudflare',
          ok: false,
          detail: (e.stderr || e.message || '').toString().slice(0, 400),
        });
        return { ok: false, steps, domain, error: 'Failed to install dns-cloudflare plugin. Run: sudo apt-get install -y python3-certbot-dns-cloudflare' };
      }
    } else {
      steps.push({ name: 'certbot-dns-cloudflare present', ok: true, skipped: true });
    }

    // Step 3: Write /etc/letsencrypt/cloudflare.ini
    try {
      const ini = `# Managed by CloudDabba — do not edit manually\ndns_cloudflare_api_token = ${token}\n`;
      await sudoWrite(CF_INI_PATH, ini, '600');
      steps.push({ name: 'Wrote cloudflare.ini (0600 root)', ok: true });
    } catch (e: any) {
      steps.push({ name: 'Wrote cloudflare.ini', ok: false, detail: e.message });
      return { ok: false, steps, domain, error: 'Failed to write credentials file' };
    }

    // Step 4: Issue wildcard cert
    const email = opts.email || (await PlatformConfig.getSslEmail()) || (await PlatformConfig.getAdminEmail());
    if (!email) {
      steps.push({ name: 'Certbot issue', ok: false, detail: 'No email set' });
      return { ok: false, steps, domain, error: 'Email required — set SSL Email in settings' };
    }

    try {
      const args = [
        'certbot', 'certonly',
        '--dns-cloudflare',
        '--dns-cloudflare-credentials', CF_INI_PATH,
        '--dns-cloudflare-propagation-seconds', '30',
        '-d', domain,
        '-d', `*.${domain}`,
        '--non-interactive', '--agree-tos',
        '-m', email,
      ];
      const { stdout } = await execFileAsync('sudo', args, { timeout: 300000 });
      const tail = stdout.split('\n').slice(-8).join(' | ').slice(0, 300);
      steps.push({ name: 'Wildcard certificate issued', ok: true, detail: tail });
    } catch (e: any) {
      let msg = (e.stderr || e.stdout || e.message || '').toString();
      try {
        const { stdout: logTail } = await execFileAsync('sudo', ['tail', '-40', '/var/log/letsencrypt/letsencrypt.log'], { timeout: 5000 });
        const errLines = logTail.split('\n').filter((l) => /error|fail|detail:|problem|api/i.test(l)).slice(-10);
        if (errLines.length) msg += '\n\nFrom letsencrypt.log:\n' + errLines.join('\n');
      } catch {}

      let hint = '';
      if (/rate limit|too many/i.test(msg)) hint = 'Let\'s Encrypt rate limit — wait ~1 hour.';
      else if (/unauthorized|invalid.*token|authentication/i.test(msg)) hint = 'Cloudflare token invalid or lacks Zone:DNS:Edit permission.';
      else if (/NXDOMAIN|no such zone|zone.*not.*found/i.test(msg)) hint = 'Domain not in the Cloudflare zone for this token.';

      steps.push({
        name: 'Wildcard certificate issued',
        ok: false,
        detail: `${hint ? hint + '\n\n' : ''}${msg.slice(0, 1500)}`,
      });
      return { ok: false, steps, domain, error: hint || 'Certbot failed' };
    }

    logger.info(`Wildcard SSL issued for ${domain} via Cloudflare DNS-01`);
    return { ok: true, steps, domain };
  }
}
