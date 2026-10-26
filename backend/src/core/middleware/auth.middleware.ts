import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/config/app.config';
import prisma from '../../database/connection';
import { AuthRequest, AppError } from '../types';

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; email: string; impersonatedBy?: string; iat?: number };

    // Revoked/deleted users must lose access immediately, not when their token expires.
    // Admin impersonation sessions are exempt from the approval check (admin can view pending users).
    const dbUser = await (prisma.user.findUnique as any)({
      where: { id: decoded.id },
      select: { role: true, approved: true, passwordChangedAt: true },
    });
    if (!dbUser) throw new AppError('User no longer exists.', 401);
    // Tokens issued before a password reset are no longer valid (1s slack for iat rounding).
    if (dbUser.passwordChangedAt && decoded.iat && decoded.iat * 1000 < dbUser.passwordChangedAt.getTime() - 1000) {
      throw new AppError('Session expired. Please log in again.', 401);
    }
    if (!decoded.impersonatedBy && dbUser.role !== 'admin' && dbUser.approved === false) {
      throw new AppError('Your account is pending admin approval.', 403);
    }

    req.user = { id: decoded.id, email: decoded.email, ...(decoded.impersonatedBy ? { impersonatedBy: decoded.impersonatedBy } : {}) };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Invalid or expired token.', 401));
  }
}
