import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';

const execFileAsync = promisify(execFile);

const TEMPLATE = `server {
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

export class NginxService {
  static async generateConfig(subdomain: string, port: number) {
    try {
      const configContent = ejs.render(TEMPLATE, {
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
      // Don't fail deployment if NGINX config fails
      logger.warn(`NGINX config failed (non-fatal): ${error.message}`);
      logger.info(`App is still accessible at http://127.0.0.1:${port}`);
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
