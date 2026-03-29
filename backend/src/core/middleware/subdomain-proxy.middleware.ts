import { Request, Response, NextFunction } from 'express';
import http from 'http';
import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';

export async function subdomainProxy(req: Request, res: Response, next: NextFunction) {
  const host = req.hostname || req.headers.host?.split(':')[0] || '';
  const baseDomain = config.domain.base;

  // Check if request is for a deployed app subdomain
  if (!host.endsWith(baseDomain) || host === baseDomain) {
    return next(); // Not a subdomain request, continue to panel
  }

  // Extract subdomain: "myapp.cloud.niketgroup.com" → "myapp"
  const subdomain = host.replace(`.${baseDomain}`, '');
  if (!subdomain || subdomain === host) {
    return next();
  }

  // Find project by subdomain
  try {
    const project = await prisma.project.findUnique({
      where: { subdomain },
      include: {
        deployments: {
          where: { status: 'LIVE' as any },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project || !project.deployments[0]?.containerPort) {
      return res.status(404).send(`<h1>App not found</h1><p>No deployment found for <b>${subdomain}.${baseDomain}</b></p>`);
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
      logger.error(`Proxy error for ${subdomain}: ${err.message}`);
      res.status(502).send(`<h1>App unavailable</h1><p>${subdomain}.${baseDomain} is not responding.</p>`);
    });

    req.pipe(proxyReq);
  } catch (err: any) {
    logger.error(`Subdomain proxy error: ${err.message}`);
    next();
  }
}
