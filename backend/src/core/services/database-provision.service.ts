import crypto from 'crypto';
import { Client } from 'pg';
import prisma from '../../database/connection';
import { encrypt, decrypt } from './encryption.service';
import { config } from '../../shared/config/app.config';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

export class DatabaseProvisionService {
  // --- PostgreSQL ---

  static async enablePostgres(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);
    if ((project as any).dbEnabled) throw new AppError('Database already enabled', 409);

    const suffix = crypto.randomBytes(3).toString('hex'); // 6-char unique suffix
    const base = project.subdomain.replace(/-/g, '_');
    const dbName = `cd_${base}_${suffix}`;
    const dbUser = `cd_${base}_${suffix}_u`;
    const dbPassword = crypto.randomBytes(24).toString('base64url');

    const adminClient = new Client({ connectionString: config.provisionDb.adminUrl });
    try {
      await adminClient.connect();
      // Create or update user
      try {
        await adminClient.query(`CREATE USER "${dbUser}" WITH PASSWORD '${dbPassword}'`);
      } catch (err: any) {
        if (err.code === '42710') {
          await adminClient.query(`ALTER USER "${dbUser}" WITH PASSWORD '${dbPassword}'`);
        } else throw err;
      }
      // Grant new role to admin so it can set OWNER
      await adminClient.query(`GRANT "${dbUser}" TO CURRENT_USER`);
      // Create database if not exists
      try {
        await adminClient.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
      } catch (err: any) {
        if (err.code !== '42P04') throw err;
      }
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}"`);
      logger.info(`Provisioned PostgreSQL: ${dbName} (user: ${dbUser})`);
    } catch (err: any) {
      throw new AppError(`Failed to provision database: ${err.message}`, 500);
    } finally {
      await adminClient.end();
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        dbEnabled: true,
        dbName,
        dbUser,
        dbPasswordEnc: encrypt(dbPassword),
      } as any,
    });

    return {
      dbEnabled: true,
      dbName,
      dbUser,
      databaseUrl: this.buildDatabaseUrl(dbUser, dbPassword, dbName),
    };
  }

  static async disablePostgres(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    await this.dropProjectDatabase(project as any);

    await prisma.project.update({
      where: { id: projectId },
      data: { dbEnabled: false, dbName: null, dbUser: null, dbPasswordEnc: null } as any,
    });
  }

  static async dropProjectDatabase(project: { dbName?: string | null; dbUser?: string | null }) {
    if (!project.dbName || !project.dbUser) return;

    const adminClient = new Client({ connectionString: config.provisionDb.adminUrl });
    try {
      await adminClient.connect();
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [project.dbName]
      );
      await adminClient.query(`DROP DATABASE IF EXISTS "${project.dbName}"`);
      await adminClient.query(`DROP USER IF EXISTS "${project.dbUser}"`);
      logger.info(`Dropped PostgreSQL: ${project.dbName}`);
    } catch (err: any) {
      logger.error(`Failed to drop database ${project.dbName}: ${err.message}`);
    } finally {
      await adminClient.end();
    }
  }

  static buildDatabaseUrl(user: string, password: string, dbName: string): string {
    return `postgresql://${user}:${password}@${config.provisionDb.host}:${config.provisionDb.port}/${dbName}`;
  }

  // --- Redis ---

  static async enableRedis(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);
    if ((project as any).redisEnabled) throw new AppError('Redis already enabled', 409);

    const dbNumber = await this.allocateRedisDbNumber();

    await prisma.project.update({
      where: { id: projectId },
      data: { redisEnabled: true, redisDbNumber: dbNumber } as any,
    });

    logger.info(`Provisioned Redis db/${dbNumber} for ${project.subdomain}`);

    return {
      redisEnabled: true,
      redisDbNumber: dbNumber,
      redisUrl: this.buildRedisUrl(dbNumber),
    };
  }

  static async disableRedis(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    await prisma.project.update({
      where: { id: projectId },
      data: { redisEnabled: false, redisDbNumber: null } as any,
    });
  }

  private static async allocateRedisDbNumber(): Promise<number> {
    const used = await prisma.$queryRaw<{ redis_db_number: number }[]>`
      SELECT redis_db_number FROM projects WHERE redis_db_number IS NOT NULL
    `;
    const usedSet = new Set(used.map((r) => r.redis_db_number));
    for (let i = 1; i <= 15; i++) {
      if (!usedSet.has(i)) return i;
    }
    throw new AppError('No available Redis database slots (max 15)', 409);
  }

  static buildRedisUrl(dbNumber: number): string {
    const { host, port, password } = config.redis;
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}/${dbNumber}`;
  }

  // --- Test Connection ---

  static async testConnection(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const p = project as any;
    const results: { postgres?: { ok: boolean; error?: string }; redis?: { ok: boolean; error?: string } } = {};

    // Test PostgreSQL
    if (p.dbEnabled && p.dbPasswordEnc && p.dbName && p.dbUser) {
      const dbPassword = decrypt(p.dbPasswordEnc);
      const connStr = this.buildDatabaseUrl(p.dbUser, dbPassword, p.dbName);
      const testClient = new Client({ connectionString: connStr, connectionTimeoutMillis: 5000 });
      try {
        await testClient.connect();
        await testClient.query('SELECT 1');
        results.postgres = { ok: true };
      } catch (err: any) {
        results.postgres = { ok: false, error: err.message };
      } finally {
        await testClient.end().catch(() => {});
      }
    }

    // Test Redis
    if (p.redisEnabled && p.redisDbNumber != null) {
      const net = await import('net');
      const redisOk = await new Promise<boolean>((resolve) => {
        const socket = new net.default.Socket();
        socket.setTimeout(3000);
        socket.connect(config.redis.port, config.redis.host, () => { socket.destroy(); resolve(true); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
      });
      results.redis = redisOk ? { ok: true } : { ok: false, error: `Cannot reach ${config.redis.host}:${config.redis.port}` };
    }

    return results;
  }

  // --- Status & Admin ---

  static async getDbStatus(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    const p = project as any;
    return {
      postgres: {
        enabled: p.dbEnabled || false,
        dbName: p.dbName || null,
        dbUser: p.dbUser || null,
        databaseUrl: p.dbEnabled && p.dbPasswordEnc
          ? this.buildDatabaseUrl(p.dbUser, decrypt(p.dbPasswordEnc), p.dbName)
          : null,
      },
      redis: {
        enabled: p.redisEnabled || false,
        dbNumber: p.redisDbNumber ?? null,
        redisUrl: p.redisEnabled ? this.buildRedisUrl(p.redisDbNumber) : null,
      },
    };
  }

  static async listAllDatabases() {
    const projects = await prisma.project.findMany({
      where: { OR: [{ dbEnabled: true } as any, { redisEnabled: true } as any] },
      include: { user: { select: { name: true, email: true } } },
    });

    return projects.map((p: any) => ({
      projectId: p.id,
      projectName: p.name,
      subdomain: p.subdomain,
      owner: p.user.name,
      ownerEmail: p.user.email,
      postgres: p.dbEnabled ? { dbName: p.dbName, dbUser: p.dbUser } : null,
      redis: p.redisEnabled ? { dbNumber: p.redisDbNumber } : null,
    }));
  }
}
