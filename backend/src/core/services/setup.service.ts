import bcrypt from 'bcryptjs';
import prisma from '../../database/connection';
import { AuthService } from './auth.service';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';
import { config } from '../../shared/config/app.config';

// In-memory cache for setup status
let cachedSetupComplete: boolean = false;
let cacheValid = false;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

export class SetupService {
  static async isSetupComplete(): Promise<boolean> {
    const now = Date.now();
    if (cacheValid && now - cacheTimestamp < CACHE_TTL) {
      return cachedSetupComplete;
    }
    try {
      const settings = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
      cachedSetupComplete = settings?.setupCompleted ?? false;
      cacheValid = true;
      cacheTimestamp = now;
      return cachedSetupComplete;
    } catch {
      return false;
    }
  }

  static invalidateCache() {
    cacheValid = false;
  }

  static async getStatus() {
    try {
      const settings = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
      const completed = settings?.setupCompleted ?? false;
      return {
        setupCompleted: completed,
        baseDomain: settings?.baseDomain ?? (completed ? null : config.domain.base || null),
        adminEmail: settings?.adminEmail ?? (completed ? null : config.domain.adminEmail || null),
        installedAt: settings?.installedAt ?? null,
      };
    } catch {
      return {
        setupCompleted: false,
        baseDomain: config.domain.base || null,
        adminEmail: config.domain.adminEmail || null,
        installedAt: null,
      };
    }
  }

  static async completeSetup(data: { domain: string; email: string; password: string; name: string }) {
    const isComplete = await this.isSetupComplete();
    if (isComplete) {
      throw new AppError('Platform setup already completed', 403);
    }

    const { domain, email, password, name } = data;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Atomic: create/update admin + mark setup complete
    const [user] = await prisma.$transaction([
      prisma.user.upsert({
        where: { email },
        update: { name, password: hashedPassword, role: 'admin' } as any,
        create: { name, email, password: hashedPassword, role: 'admin' } as any,
      }),
      (prisma as any).platformSettings.upsert({
        where: { id: 'singleton' },
        update: {
          setupCompleted: true,
          baseDomain: domain,
          adminEmail: email,
          installedAt: new Date(),
        },
        create: {
          id: 'singleton',
          setupCompleted: true,
          baseDomain: domain,
          adminEmail: email,
          installedAt: new Date(),
        },
      }),
    ]);

    this.invalidateCache();
    logger.info(`Platform setup completed: domain=${domain}, admin=${email}`);

    const token = AuthService.generateToken(user.id, user.email);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: 'admin' },
      token,
    };
  }
}
