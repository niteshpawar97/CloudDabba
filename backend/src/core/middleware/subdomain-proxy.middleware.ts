import { Request, Response, NextFunction } from 'express';
import http from 'http';
import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import { PlatformConfig } from '../services/platform-config.service';
import logger from '../../shared/utils/logger';

async function sendErrorPage(res: Response, statusCode: number, title: string, message: string, subdomain: string) {
  const baseDomain = await PlatformConfig.getBaseDomain();
  res.status(statusCode).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — CloudDabba</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      text-align: center;
      max-width: 500px;
      padding: 40px 20px;
    }
    .status-code {
      font-size: 72px;
      font-weight: 800;
      color: ${statusCode === 502 ? '#f59e0b' : '#ef4444'};
      line-height: 1;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #f1f5f9;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .domain {
      display: inline-block;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 14px;
      font-family: ui-monospace, monospace;
      font-size: 14px;
      color: #60a5fa;
      margin: 16px 0;
    }
    .actions {
      margin-top: 24px;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    .btn-secondary:hover { background: #334155; color: #e2e8f0; }
    .footer {
      margin-top: 40px;
      color: #475569;
      font-size: 13px;
    }
    .footer a { color: #60a5fa; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .hint {
      margin-top: 20px;
      padding: 12px 16px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 13px;
      color: #64748b;
      text-align: left;
    }
    .hint strong { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="status-code">${statusCode}</div>
    <h1>${title}</h1>
    <div class="domain">${subdomain}.${baseDomain}</div>
    <p>${message}</p>
    ${statusCode === 502 ? `
    <div class="hint">
      <strong>Possible reasons:</strong><br>
      &bull; The app container may have crashed<br>
      &bull; The app is still starting up — try again in a few seconds<br>
      &bull; The app's port configuration may be incorrect
    </div>` : ''}
    ${statusCode === 404 ? `
    <div class="hint">
      <strong>Possible reasons:</strong><br>
      &bull; This project has not been deployed yet<br>
      &bull; The deployment may have been stopped<br>
      &bull; The subdomain may be incorrect
    </div>` : ''}
    <div class="actions">
      <a href="javascript:location.reload()" class="btn btn-primary">Try Again</a>
      <a href="https://${baseDomain}" class="btn btn-secondary">Go to CloudDabba</a>
    </div>
    <div class="footer">
      Powered by <a href="https://${baseDomain}">CloudDabba</a> — Self-hosted PaaS
    </div>
  </div>
</body>
</html>`);
}

export async function subdomainProxy(req: Request, res: Response, next: NextFunction) {
  const host = req.hostname || req.headers.host?.split(':')[0] || '';
  const baseDomain = await PlatformConfig.getBaseDomain();

  let subdomain = '';
  let isCustomDomain = false;

  // Check if request is for a subdomain of base domain
  if (host.endsWith(baseDomain) && host !== baseDomain) {
    subdomain = host.replace(`.${baseDomain}`, '');
    if (!subdomain || subdomain === host) return next();
  }
  // Check if it's a custom domain (not base domain, not localhost)
  else if (host !== baseDomain && host !== 'localhost' && !host.startsWith('127.') && host.includes('.')) {
    isCustomDomain = true;
  }
  else {
    return next();
  }

  try {
    // Find project by subdomain or custom domain
    const project = isCustomDomain
      ? await prisma.project.findFirst({
          where: { customDomain: host, domainVerified: true } as any,
          include: {
            deployments: {
              where: { status: 'LIVE' as any },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        })
      : await prisma.project.findUnique({
          where: { subdomain },
          include: {
            deployments: {
              where: { status: 'LIVE' as any },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        });

    const displayName = isCustomDomain ? host : subdomain;

    if (!project || !project.deployments[0]?.containerPort) {
      return sendErrorPage(res, 404, 'App Not Found',
        'There is no active deployment for this domain.', displayName);
    }

    const containerPort = project.deployments[0].containerPort;

    // Proxy request to container
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: containerPort,
        path: req.originalUrl,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${containerPort}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      logger.error(`Proxy error for ${displayName}: ${err.message}`);
      void sendErrorPage(res, 502, 'App Unavailable',
        'The application is not responding. It may have crashed or is still starting up.', displayName);
    });

    req.pipe(proxyReq);
  } catch (err: any) {
    logger.error(`Subdomain proxy error: ${err.message}`);
    next();
  }
}
