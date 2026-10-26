import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { AppError } from '../types';
import { NotificationService } from './notification.service';

const TTL_MS = 60 * 60 * 1000;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Password reset via single-use, 1-hour tokens. Only a SHA-256 hash of the token
 * is stored, so a database leak cannot be used to take over accounts.
 */
export class PasswordResetService {
  /** Base URL for links - taken from server configuration only, never from request headers. */
  private static async appUrl(): Promise<string> {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
    const row: any = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    const domain = row?.baseDomain || process.env.BASE_DOMAIN || 'localhost';
    return `${row?.sslEnabled ? 'https' : 'http'}://${domain}`;
  }

  private static async createToken(userId: string) {
    const token = crypto.randomBytes(32).toString('base64url');
    // One live token per user: issuing a new one revokes the previous ones.
    await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return `${await this.appUrl()}/reset-password?token=${token}`;
  }

  /**
   * Self-service request. Always succeeds from the caller's point of view so the
   * endpoint cannot be used to find out which emails are registered.
   */
  static async requestReset(email: string): Promise<{ emailed: boolean }> {
    const user: any = await prisma.user.findUnique({ where: { email } });
    if (!user) return { emailed: false };
    if (user.role !== 'admin' && user.approved === false) return { emailed: false }; // pending users can't log in anyway
    const link = await this.createToken(user.id);
    try {
      await NotificationService.sendEmail(
        user.email,
        'Reset your CloudDabba password',
        `Hi ${user.name},\n\nUse this link to set a new password (valid for 1 hour, single use):\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      );
      return { emailed: true };
    } catch (e: any) {
      logger.warn(`Password reset email to ${email} not sent: ${e.message}`);
      return { emailed: false };
    }
  }

  /** Admin-generated link, for when email is not configured. */
  static async adminLink(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user) throw new AppError('User not found', 404);
    return { link: await this.createToken(user.id), email: user.email, expiresInMinutes: TTL_MS / 60000 };
  }

  static async reset(token: string, password: string) {
    if (!token || typeof token !== 'string') throw new AppError('Invalid or expired reset link', 400);
    if (!password || password.length < 6) throw new AppError('Password must be at least 6 characters', 400);

    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError('Invalid or expired reset link', 400);

    const hashed = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      // passwordChangedAt invalidates every JWT issued before now (checked in the auth middleware)
      prisma.user.update({ where: { id: row.userId }, data: { password: hashed, passwordChangedAt: new Date() } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
    ]);
    return { id: row.user.id, email: row.user.email };
  }

  static startPruner() {
    const run = () =>
      prisma.passwordResetToken
        .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } }, { usedAt: { not: null } }] } })
        .catch(() => undefined);
    setInterval(run, 6 * 60 * 60 * 1000).unref?.();
  }
}
