import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import { AppError } from '../types';
import { encrypt, decrypt } from './encryption.service';

export class AuthService {
  static async signup(name: string, email: string, password: string) {
    const { PlatformConfig } = require('./platform-config.service');
    const allowed = await PlatformConfig.isSignupAllowed();
    if (!allowed) {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        throw new AppError('Public signup is disabled. Please contact the administrator.', 403);
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // The very first account on a fresh install is approved automatically;
    // everyone after needs an admin to approve them before they can log in.
    const isFirstUser = (await prisma.user.count()) === 0;
    const user = await (prisma.user.create as any)({
      data: { name, email, password: hashedPassword, approved: isFirstUser },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!isFirstUser) {
      return { user, token: null, pendingApproval: true };
    }
    const token = this.generateToken(user.id, user.email);
    return { user, token, pendingApproval: false };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    if ((user as any).role !== 'admin' && (user as any).approved === false) {
      throw new AppError('Your account is pending admin approval. You can log in once an admin approves it.', 403);
    }

    const token = this.generateToken(user.id, user.email);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user as any).role || 'user',
        hasPAT: !!user.githubPatEncrypted,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  static async getProfile(userId: string) {
    const user = await (prisma.user.findUnique as any)({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, approved: true, githubPatEncrypted: true, createdAt: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.role !== 'admin' && user.approved === false) {
      throw new AppError('Your account is pending admin approval.', 403);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      hasPAT: !!user.githubPatEncrypted,
      createdAt: user.createdAt,
    };
  }

  static async storeGitHubPAT(userId: string, pat: string) {
    const encrypted = encrypt(pat);
    await prisma.user.update({
      where: { id: userId },
      data: { githubPatEncrypted: encrypted },
    });
  }

  static async removeGitHubPAT(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { githubPatEncrypted: null },
    });
  }

  static async getDecryptedPAT(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubPatEncrypted: true },
    });
    if (!user?.githubPatEncrypted) {
      throw new AppError('GitHub PAT not configured', 400);
    }
    return decrypt(user.githubPatEncrypted);
  }

  static generateToken(id: string, email: string, opts?: { impersonatedBy?: string; expiresIn?: string }): string {
    return jwt.sign(
      { id, email, ...(opts?.impersonatedBy ? { impersonatedBy: opts.impersonatedBy } : {}) },
      config.jwt.secret,
      { expiresIn: opts?.expiresIn || config.jwt.expire } as jwt.SignOptions,
    );
  }

  /** Admin-only (enforced by route): issue a short-lived token for another user. */
  static async impersonate(adminId: string, targetId: string) {
    if (adminId === targetId) throw new AppError('You are already logged in as this user', 400);
    const target = await (prisma.user.findUnique as any)({ where: { id: targetId } });
    if (!target) throw new AppError('User not found', 404);
    const token = this.generateToken(target.id, target.email, { impersonatedBy: adminId, expiresIn: '2h' });
    return {
      token,
      user: {
        id: target.id, name: target.name, email: target.email, role: target.role || 'user',
        hasPAT: !!target.githubPatEncrypted, createdAt: target.createdAt,
      },
    };
  }
}
