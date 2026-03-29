import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/config/app.config';
import { AuthRequest, AppError } from '../types';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; email: string };

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Invalid or expired token.', 401));
  }
}
