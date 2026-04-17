import dns from 'dns/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import net from 'net';
import logger from '../../shared/utils/logger';
import { config } from '../../shared/config/app.config';

const execFileAsync = promisify(execFile);

export class DomainDiagnosticsService {
  /** Public IP of this server (cached for 1h). */
  private static cachedIp: { ip: string; at: number } | null = null;

  static async getServerIp(): Promise<string> {
    if (this.cachedIp && Date.now() - this.cachedIp.at < 3_600_000) return this.cachedIp.ip;
    try {
      const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) });
      const ip = (await res.text()).trim();
      if (ip) {
        this.cachedIp = { ip, at: Date.now() };
        return ip;
      }
    } catch {}
    try {
      const res = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(5000) });
      const ip = (await res.text()).trim();
      if (ip) {
        this.cachedIp = { ip, at: Date.now() };
        return ip;
      }
    } catch {}
    return '';
  }

  /** Resolve A records and compare against server IP. */
  static async testDns(domain: string) {
    const clean = (domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean || !clean.includes('.')) {
      return { ok: false, error: 'Invalid domain' };
    }
    const serverIp = await this.getServerIp();
    const result: any = { domain: clean, serverIp, apex: null, wildcard: null };

    try {
      const apexIps = await dns.resolve4(clean);
      result.apex = {
        resolved: apexIps,
        matches: serverIp ? apexIps.includes(serverIp) : false,
      };
    } catch (e: any) {
      result.apex = { resolved: [], matches: false, error: e.code || e.message };
    }

    try {
      const testSub = `clouddabba-check.${clean}`;
      const wildIps = await dns.resolve4(testSub);
      result.wildcard = {
        resolved: wildIps,
        matches: serverIp ? wildIps.includes(serverIp) : false,
      };
    } catch (e: any) {
      result.wildcard = { resolved: [], matches: false, error: e.code || e.message };
    }

    result.ok = result.apex?.matches && result.wildcard?.matches;
    return result;
  }

  /** Read certbot live cert info for a domain. */
  static async getSslStatus(domain?: string) {
    const target = (domain || '').trim();
    const certDirs = ['/etc/letsencrypt/live'];
    try {
      const list: string[] = [];
      for (const dir of certDirs) {
        try {
          const entries = await fs.readdir(dir);
          for (const e of entries) {
            if (e === 'README') continue;
            list.push(e);
          }
        } catch {}
      }

      if (list.length === 0) {
        return { installed: false, certs: [] };
      }

      const certs = [];
      for (const name of list) {
        const certFile = `/etc/letsencrypt/live/${name}/cert.pem`;
        try {
          const { stdout } = await execFileAsync('sudo', [
            'openssl', 'x509', '-in', certFile,
            '-noout', '-subject', '-issuer', '-dates', '-ext', 'subjectAltName',
          ], { timeout: 5000 });

          const subject = /subject=.*CN\s*=\s*([^\n,\/]+)/.exec(stdout)?.[1]?.trim();
          const issuer = /issuer=.*O\s*=\s*([^\n,\/]+)/.exec(stdout)?.[1]?.trim();
          const notAfter = /notAfter=(.+)/.exec(stdout)?.[1]?.trim();
          const sanMatch = /X509v3 Subject Alternative Name:\s*\n\s*(.+)/.exec(stdout);
          const sans = sanMatch
            ? sanMatch[1].split(',').map((s) => s.trim().replace(/^DNS:/, ''))
            : [];

          const expiresAt = notAfter ? new Date(notAfter) : null;
          const daysLeft = expiresAt
            ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          certs.push({
            name,
            subject,
            issuer,
            expiresAt: expiresAt?.toISOString() ?? null,
            daysLeft,
            sans,
            wildcardCovered: sans.some((s) => s.startsWith('*.')),
          });
        } catch (e: any) {
          certs.push({ name, error: e.message });
        }
      }

      const match = target
        ? certs.find((c) => c.name === target || c.sans?.includes(target) || c.sans?.includes(`*.${target}`))
        : certs[0];

      return { installed: certs.length > 0, certs, active: match ?? null };
    } catch (e: any) {
      logger.warn(`SSL status read failed: ${e.message}`);
      return { installed: false, certs: [], error: e.message };
    }
  }

  /** Check how many ports in the configured range are in use / free. */
  static async getPortRangeStatus() {
    const start = config.ports.rangeStart;
    const end = config.ports.rangeEnd;
    const total = end - start + 1;

    let used = 0;
    try {
      const { stdout } = await execFileAsync('ss', ['-tln'], { timeout: 5000 });
      const lines = stdout.split('\n');
      const usedPorts = new Set<number>();
      for (const line of lines) {
        const m = /:(\d+)\s/.exec(line);
        if (m) {
          const p = parseInt(m[1], 10);
          if (p >= start && p <= end) usedPorts.add(p);
        }
      }
      used = usedPorts.size;
    } catch {
      used = -1;
    }

    const sampleFree = await this.tryBind(start, 5, end);

    return {
      start,
      end,
      total,
      used,
      free: used >= 0 ? total - used : null,
      kernelAvailable: sampleFree,
    };
  }

  private static async tryBind(from: number, count: number, max: number) {
    const results: { port: number; free: boolean }[] = [];
    for (let p = from, tried = 0; tried < count && p <= max; p++, tried++) {
      const free = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => server.close(() => resolve(true)));
        try {
          server.listen(p, '127.0.0.1');
        } catch {
          resolve(false);
        }
      });
      results.push({ port: p, free });
    }
    return results;
  }
}
