import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import { AppError } from '../types';
import { encrypt, decrypt } from './encryption.service';

export class AuthService {
  static async signup(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = this.generateToken(user.id, user.email);
    return { user, token };
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
      select: { id: true, name: true, email: true, role: true, githubPatEncrypted: true, createdAt: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
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

  static generateToken(id: string, email: string): string {
    return jwt.sign({ id, email }, config.jwt.secret, {
      expiresIn: config.jwt.expire,
    } as jwt.SignOptions);
  }
}
