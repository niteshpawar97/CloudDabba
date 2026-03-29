import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const isDev = process.env.NODE_ENV === 'development';

// Use real IP from X-Forwarded-For, fallback to req.ip
function keyGenerator(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // Use token hash as key so each user gets their own limit
    return authHeader.slice(-16);
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  keyGenerator,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  keyGenerator,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deployLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  keyGenerator,
  message: { success: false, message: 'Too many deploy requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
