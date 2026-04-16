import { Request, Response, NextFunction } from 'express';
import { SetupService } from '../services/setup.service';

export async function setupGuard(req: Request, res: Response, next: NextFunction) {
  // Always allow: setup endpoints, health check, static files, webhooks
  const path = req.path;
  if (
    path.includes('/setup') ||
    path.includes('/health') ||
    path.includes('/webhook') ||
    !path.startsWith('/api')
  ) {
    return next();
  }

  try {
    const isComplete = await SetupService.isSetupComplete();
    if (isComplete) return next();

    res.status(503).json({
      success: false,
      message: 'Platform setup required',
      code: 'SETUP_REQUIRED',
    });
  } catch {
    // If check fails, allow through (don't block on setup check errors)
    next();
  }
}
