import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { config } from './shared/config/app.config';
import { errorHandler } from './core/middleware/error-handler.middleware';
import { generalLimiter } from './core/middleware/rate-limit.middleware';
import { subdomainProxy } from './core/middleware/subdomain-proxy.middleware';
import routes from './api/routes';
import webhookRoutes from './api/routes/webhook.routes';

const app = express();

// Trust proxy (NGINX / Vite proxy) — get real client IP
app.set('trust proxy', 1);

// Subdomain proxy FIRST — before helmet/cors/etc so deployed apps get clean responses
app.use(subdomainProxy);

// Security (only applies to CloudDabba panel, not deployed apps)
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (config.app.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
app.use(generalLimiter);

// Webhook routes (no version prefix — URLs must be stable)
app.use('/api/webhook', webhookRoutes);

// API Routes
app.use(`/api/${config.app.apiVersion}`, routes);

// Serve frontend static files (production)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
