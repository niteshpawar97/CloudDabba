import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';

const execFileAsync = promisify(execFile);

const SUBDOMAIN_TEMPLATE = `server {
    listen 80;
    server_name <%= subdomain %>.<%= baseDomain %>;

    location / {
        proxy_pass http://127.0.0.1:<%= port %>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

const CUSTOM_DOMAIN_TEMPLATE = `server {
    listen 80;
    server_name <%= customDomain %>;

    location / {
        proxy_pass http://127.0.0.1:<%= port %>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

// Redirect www → non-www (or vice versa)
const REDIRECT_TEMPLATE = `server {
    listen 80;
    server_name <%= from %>;
    return 301 <%= protocol %>://<%= to %>$request_uri;
}
`;

export class NginxService {
  static async generateConfig(subdomain: string, port: number) {
    try {
      const configContent = ejs.render(SUBDOMAIN_TEMPLATE, {
        subdomain,
        port,
        baseDomain: config.domain.base,
      });

      const configPath = path.join(config.nginx.sitesPath, `${subdomain}.conf`);
      await fs.mkdir(config.nginx.sitesPath, { recursive: true });
      await fs.writeFile(configPath, configContent, 'utf-8');
      logger.info(`NGINX config generated: ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`NGINX config failed (non-fatal): ${error.message}`);
      logger.info(`App is still accessible at http://127.0.0.1:${port}`);
    }
  }

  static async generateCustomDomainConfig(customDomain: string, port: number, wwwRedirect: 'none' | 'www-to-root' | 'root-to-www' = 'www-to-root') {
    try {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      let configContent = ejs.render(CUSTOM_DOMAIN_TEMPLATE, { customDomain, port });

      // Add www redirect
      if (wwwRedirect === 'www-to-root' && !customDomain.startsWith('www.')) {
        configContent += '\n' + ejs.render(REDIRECT_TEMPLATE, {
          from: `www.${customDomain}`,
          to: customDomain,
          protocol,
        });
      } else if (wwwRedirect === 'root-to-www' && !customDomain.startsWith('www.')) {
        configContent += '\n' + ejs.render(REDIRECT_TEMPLATE, {
          from: customDomain,
          to: `www.${customDomain}`,
          protocol,
        });
      }

      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await fs.mkdir(config.nginx.sitesPath, { recursive: true });
      await fs.writeFile(configPath, configContent, 'utf-8');
      logger.info(`Custom domain NGINX config: ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`Custom domain NGINX config failed (non-fatal): ${error.message}`);
    }
  }

  static async removeCustomDomainConfig(customDomain: string) {
    try {
      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await fs.unlink(configPath);
      logger.info(`Custom domain NGINX config removed: ${configPath}`);
      await this.reload();
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Custom domain NGINX removal failed: ${error.message}`);
      }
    }
  }

  static async removeConfig(subdomain: string) {
    try {
      const configPath = path.join(config.nginx.sitesPath, `${subdomain}.conf`);
      await fs.unlink(configPath);
      logger.info(`NGINX config removed: ${configPath}`);
      await this.reload();
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn(`NGINX config removal failed (non-fatal): ${error.message}`);
      }
    }
  }

  /**
   * Auto-issue SSL certificate for custom domain via certbot.
   * Runs after NGINX config is generated and domain is verified.
   * Non-fatal — app works on HTTP if SSL fails.
   */
  static async issueSslCertificate(customDomain: string) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`SSL skip (non-production): ${customDomain}`);
      return;
    }

    try {
      // Build domain args: -d domain.com -d www.domain.com
      const domains = [customDomain];
      if (!customDomain.startsWith('www.')) {
        domains.push(`www.${customDomain}`);
      }
      const domainArgs = domains.flatMap((d) => ['-d', d]);

      await execFileAsync('certbot', [
        '--nginx',
        '--non-interactive',
        '--agree-tos',
        '--redirect',
        '--email', process.env.SSL_EMAIL || 'admin@clouddabba.dev',
        ...domainArgs,
      ], { timeout: 120000 });

      logger.info(`SSL certificate issued for ${customDomain}`);
    } catch (error: any) {
      // Non-fatal — app still works on HTTP
      logger.warn(`SSL certificate failed for ${customDomain} (non-fatal): ${error.message}`);
    }
  }

  static async reload() {
    try {
      const [cmd, ...args] = config.nginx.reloadCmd.split(' ');
      await execFileAsync(cmd, args);
      logger.info('NGINX reloaded successfully');
    } catch (error: any) {
      logger.warn(`NGINX reload skipped: ${error.message}`);
    }
  }
}
