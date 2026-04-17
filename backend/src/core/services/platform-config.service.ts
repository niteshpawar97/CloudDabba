import prisma from '../../database/connection';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';

interface CachedSettings {
  platformName: string;
  baseDomain: string;
  adminEmail: string;
  sslEmail: string;
  corsOrigins: string[];
  allowSignup: boolean;
  defaultBranch: string;
}

let cache: CachedSettings | null = null;
let cachedAt = 0;
const TTL = 30_000;

async function load(): Promise<CachedSettings> {
  const envOrigins = (config.cors.origin || []).filter(Boolean);
  try {
    const row = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
    const rawOrigins: string | null = row?.corsOrigins ?? null;
    const corsOrigins = rawOrigins
      ? rawOrigins.split(',').map((s: string) => s.trim()).filter(Boolean)
      : envOrigins;
    return {
      platformName: row?.platformName || 'CloudDabba',
      baseDomain: row?.baseDomain || config.domain.base || 'localhost',
      adminEmail: row?.adminEmail || config.domain.adminEmail || '',
      sslEmail: row?.sslEmail || row?.adminEmail || config.domain.adminEmail || '',
      corsOrigins,
      allowSignup: row?.allowSignup ?? true,
      defaultBranch: row?.defaultBranch || 'main',
    };
  } catch (e: any) {
    logger.warn(`PlatformConfig: DB read failed, using .env defaults (${e.message})`);
    return {
      platformName: 'CloudDabba',
      baseDomain: config.domain.base || 'localhost',
      adminEmail: config.domain.adminEmail || '',
      sslEmail: config.domain.adminEmail || '',
      corsOrigins: envOrigins,
      allowSignup: true,
      defaultBranch: 'main',
    };
  }
}

async function get(): Promise<CachedSettings> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL) return cache;
  cache = await load();
  cachedAt = now;
  return cache;
}

export class PlatformConfig {
  static async settings() {
    return get();
  }

  static async getPlatformName() {
    return (await get()).platformName;
  }

  static async getBaseDomain() {
    return (await get()).baseDomain;
  }

  static async getAdminEmail() {
    return (await get()).adminEmail;
  }

  static async getSslEmail() {
    return (await get()).sslEmail;
  }

  static async getCorsOrigins() {
    return (await get()).corsOrigins;
  }

  static async isSignupAllowed() {
    return (await get()).allowSignup;
  }

  static async getDefaultBranch() {
    return (await get()).defaultBranch;
  }

  static invalidate() {
    cache = null;
    cachedAt = 0;
  }
}
