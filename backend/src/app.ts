import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './shared/config/app.config';
import { errorHandler } from './core/middleware/error-handler.middleware';
import { generalLimiter } from './core/middleware/rate-limit.middleware';
import routes from './api/routes';

const app = express();

// Trust proxy (NGINX / Vite proxy) — get real client IP
app.set('trust proxy', 1);

// Security
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

// API Routes
app.use(`/api/${config.app.apiVersion}`, routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
