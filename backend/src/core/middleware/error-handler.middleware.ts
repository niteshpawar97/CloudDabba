import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  logger.error('Unhandled error:', err);

  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

  return res.status(statusCode).json({
    success: false,
    message,
  });
}
