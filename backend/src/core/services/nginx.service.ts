import { execFile } from 'child_process';
import { promisify } from 'util';
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

// Redirect subdomain → custom domain (when custom domain is verified)
const SUBDOMAIN_REDIRECT_TEMPLATE = `server {
    listen 80;
    server_name <%= subdomain %>.<%= baseDomain %>;
    return 301 <%= scheme %>://<%= customDomain %>$request_uri;
}
`;

// Helper: write file via sudo (for /etc/nginx/sites-enabled/)
async function sudoWriteFile(filePath: string, content: string) {
  const os = require('os');
  const fs = require('fs/promises');
  const tmpFile = path.join(os.tmpdir(), `nginx-${Date.now()}.conf`);
  await fs.writeFile(tmpFile, content, 'utf-8');
  await execFileAsync('sudo', ['cp', tmpFile, filePath], { timeout: 10000 });
  await fs.unlink(tmpFile).catch(() => {});
}

async function sudoDeleteFile(filePath: string) {
  await execFileAsync('sudo', ['rm', '-f', filePath], { timeout: 5000 });
}

export class NginxService {
  static async generateConfig(subdomain: string, port: number) {
    try {
      const configContent = ejs.render(SUBDOMAIN_TEMPLATE, {
        subdomain,
        port,
        baseDomain: config.domain.base,
      });

      const configPath = path.join(config.nginx.sitesPath, `${subdomain}.conf`);
      await sudoWriteFile(configPath, configContent);
      logger.info(`NGINX config generated: ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`NGINX config failed (non-fatal): ${error.message}`);
      logger.info(`App is still accessible at http://127.0.0.1:${port}`);
    }
  }

  /**
   * Replace subdomain proxy with a 301 redirect to custom domain.
   */
  static async generateRedirectConfig(subdomain: string, customDomain: string) {
    try {
      const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const configContent = ejs.render(SUBDOMAIN_REDIRECT_TEMPLATE, {
        subdomain,
        baseDomain: config.domain.base,
        customDomain,
        scheme,
      });

      const configPath = path.join(config.nginx.sitesPath, `${subdomain}.conf`);
      await sudoWriteFile(configPath, configContent);
      logger.info(`NGINX redirect config: ${subdomain}.${config.domain.base} → ${customDomain}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`NGINX redirect config failed (non-fatal): ${error.message}`);
    }
  }

  static async generateCustomDomainConfig(customDomain: string, port: number) {
    try {
      const isRootDomain = customDomain.split('.').length <= 2;
      const hasWww = isRootDomain && !customDomain.startsWith('www.');

      const configContent = ejs.render(CUSTOM_DOMAIN_HTTP_TEMPLATE, { customDomain, port, hasWww });

      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await sudoWriteFile(configPath, configContent);
      logger.info(`Custom domain NGINX config (HTTP): ${configPath}`);

      await this.reload();
    } catch (error: any) {
      logger.warn(`Custom domain NGINX config failed (non-fatal): ${error.message}`);
    }
  }

  static async upgradeToSsl(customDomain: string, port: number) {
    try {
      const isRootDomain = customDomain.split('.').length <= 2;
      const hasWww = isRootDomain && !customDomain.startsWith('www.');
      const configContent = ejs.render(CUSTOM_DOMAIN_SSL_TEMPLATE, { customDomain, port, hasWww });

      const safeName = customDomain.replace(/[^a-z0-9.-]/gi, '_');
      const configPath = path.join(config.nginx.sitesPath, `custom-${safeName}.conf`);
      await sudoWriteFile(configPath, configContent);
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
      await sudoDeleteFile(configPath);
      logger.info(`Custom domain NGINX config removed: ${configPath}`);
      await this.reload();
    } catch (error: any) {
      if (!error.message?.includes('No such file')) {
        logger.warn(`Custom domain NGINX removal failed: ${error.message}`);
      }
    }
  }

  static async removeConfig(subdomain: string) {
    try {
      const configPath = path.join(config.nginx.sitesPath, `${subdomain}.conf`);
      await sudoDeleteFile(configPath);
      logger.info(`NGINX config removed: ${configPath}`);
      await this.reload();
    } catch (error: any) {
      if (!error.message?.includes('No such file')) {
        logger.warn(`NGINX config removal failed (non-fatal): ${error.message}`);
      }
    }
  }

  static async issueSslCertificate(customDomain: string, port: number) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`SSL skip (non-production): ${customDomain}`);
      return;
    }

    try {
      const domains = [customDomain];
      const isRootDomain = customDomain.split('.').length <= 2;
      if (isRootDomain && !customDomain.startsWith('www.')) {
        domains.push(`www.${customDomain}`);
      }
      const domainArgs = domains.flatMap((d) => ['-d', d]);

      await execFileAsync('sudo', [
        'certbot', 'certonly',
        '--nginx',
        '--non-interactive',
        '--agree-tos',
        '--email', process.env.SSL_EMAIL || 'admin@clouddabba.dev',
        ...domainArgs,
      ], { timeout: 120000 });

      logger.info(`SSL certificate issued for ${customDomain}`);

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
