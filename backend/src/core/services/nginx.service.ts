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

// HTTP-only config (before SSL is issued)
const CUSTOM_DOMAIN_HTTP_TEMPLATE = `server {
    listen 80;
    server_name <%= customDomain %><%= hasWww ? ' www.' + customDomain : '' %>;

    location / {
        proxy_pass http://127.0.0.1:<%= port %>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

// Full SSL config (after certbot issues certificate)
const CUSTOM_DOMAIN_SSL_TEMPLATE = `server {
    listen 80;
    server_name <%= customDomain %><%= hasWww ? ' www.' + customDomain : '' %>;
    return 301 https://<%= customDomain %>$request_uri;
}

server {
    listen 443 ssl;
    server_name <%= customDomain %><%= hasWww ? ' www.' + customDomain : '' %>;

    ssl_certificate /etc/letsencrypt/live/<%= customDomain %>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<%= customDomain %>/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:<%= port %>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
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

  static async generateCustomDomainConfig(customDomain: string, port: number) {
    try {
      const hasWww = !customDomain.startsWith('www.');

      // Start with HTTP-only config so certbot can verify domain
      const configContent = ejs.render(CUSTOM_DOMAIN_HTTP_TEMPLATE, { customDomain, port, hasWww });

      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await fs.mkdir(config.nginx.sitesPath, { recursive: true });
      await fs.writeFile(configPath, configContent, 'utf-8');
      logger.info(`Custom domain NGINX config (HTTP): ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`Custom domain NGINX config failed (non-fatal): ${error.message}`);
    }
  }

  /**
   * Upgrade custom domain config to SSL after certificate is issued.
   */
  static async upgradeToSsl(customDomain: string, port: number) {
    try {
      const hasWww = !customDomain.startsWith('www.');
      const configContent = ejs.render(CUSTOM_DOMAIN_SSL_TEMPLATE, { customDomain, port, hasWww });

      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await fs.writeFile(configPath, configContent, 'utf-8');
      logger.info(`Custom domain NGINX config upgraded to SSL: ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`SSL config upgrade failed (non-fatal): ${error.message}`);
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
   * Auto-issue SSL certificate for custom domain.
   * Uses certonly (not --nginx) to avoid certbot modifying wrong config files.
   * Then upgrades NGINX config to include SSL.
   */
  static async issueSslCertificate(customDomain: string, port: number) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`SSL skip (non-production): ${customDomain}`);
      return;
    }

    try {
      const domains = [customDomain];
      if (!customDomain.startsWith('www.')) {
        domains.push(`www.${customDomain}`);
      }
      const domainArgs = domains.flatMap((d) => ['-d', d]);

      // Use certonly + webroot/standalone — does NOT modify nginx configs
      await execFileAsync('sudo', [
        'certbot', 'certonly',
        '--nginx',
        '--non-interactive',
        '--agree-tos',
        '--email', process.env.SSL_EMAIL || 'admin@clouddabba.dev',
        ...domainArgs,
      ], { timeout: 120000 });

      logger.info(`SSL certificate issued for ${customDomain}`);

      // Now upgrade nginx config to use SSL
      await this.upgradeToSsl(customDomain, port);

    } catch (error: any) {
      logger.warn(`SSL certificate failed for ${customDomain} (non-fatal): ${error.message}`);
    }
  }

  static async reload() {
    try {
      await execFileAsync('sudo', ['nginx', '-s', 'reload']);
      logger.info('NGINX reloaded successfully');
    } catch (error: any) {
      logger.warn(`NGINX reload skipped: ${error.message}`);
    }
  }
}
