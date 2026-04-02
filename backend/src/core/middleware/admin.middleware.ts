import { Response, NextFunction } from 'express';
import prisma from '../../database/connection';
import { AuthRequest, AppError } from '../types';

export async function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await (prisma.user.findUnique as any)({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}
