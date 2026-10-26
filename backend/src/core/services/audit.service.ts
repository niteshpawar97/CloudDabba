import { Request } from 'express';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';
import { AuthRequest } from '../types';

/**
 * Append-only record of security-relevant actions. Writing an audit entry must
 * never break the action it describes, so log() swallows its own errors.
 * Never put secrets (passwords, tokens, URLs with credentials) in `meta`.
 */

export interface AuditTarget {
  type?: string;
  id?: string;
  label?: string;
}

const RETENTION_DAYS = 180;

function clientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first || req.ip || req.socket?.remoteAddress || '').trim().slice(0, 64) || undefined;
}

export class AuditService {
  /**
   * @param req    current request (actor + IP are taken from it)
   * @param action dotted name, e.g. "user.impersonate"
   */
  static log(req: AuthRequest | undefined, action: string, target: AuditTarget = {}, meta?: Record<string, unknown>) {
    void this.write({
      actorId: req?.user?.id,
      actorEmail: req?.user?.email,
      impersonatedBy: req?.user?.impersonatedBy,
      action, target, ip: clientIp(req), meta,
    });
  }

  /** For events with no authenticated request (login attempts, password reset). */
  static logAnonymous(req: Request | undefined, action: string, actorEmail: string | undefined, target: AuditTarget = {}, meta?: Record<string, unknown>) {
    void this.write({ actorEmail, action, target, ip: clientIp(req), meta });
  }

  private static async write(e: {
    actorId?: string; actorEmail?: string; impersonatedBy?: string; action: string;
    target: AuditTarget; ip?: string; meta?: Record<string, unknown>;
  }) {
    try {
      let impersonatedBy: string | undefined;
      if (e.impersonatedBy) {
        const admin = await prisma.user.findUnique({ where: { id: e.impersonatedBy }, select: { email: true } });
        impersonatedBy = admin?.email || e.impersonatedBy;
      }
      await (prisma as any).auditLog.create({
        data: {
          actorId: e.actorId, actorEmail: e.actorEmail?.slice(0, 255), impersonatedBy,
          action: e.action, targetType: e.target.type, targetId: e.target.id?.slice(0, 64),
          targetLabel: e.target.label?.slice(0, 255), ip: e.ip, meta: e.meta as any,
        },
      });
    } catch (err: any) {
      logger.warn(`Audit log write failed (${e.action}): ${err.message}`);
    }
  }

  static async list(opts: { page?: number; limit?: number; action?: string; actor?: string }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    const where: any = {};
    if (opts.action) where.action = { contains: opts.action, mode: 'insensitive' };
    if (opts.actor) {
      where.OR = [
        { actorEmail: { contains: opts.actor, mode: 'insensitive' } },
        { impersonatedBy: { contains: opts.actor, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      (prisma as any).auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      (prisma as any).auditLog.count({ where }),
    ]);
    return { logs: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  static startPruner() {
    const run = () =>
      (prisma as any).auditLog
        .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400_000) } } })
        .catch((e: any) => logger.warn(`Audit prune failed: ${e.message}`));
    setInterval(run, 24 * 60 * 60 * 1000).unref?.();
    setTimeout(run, 10 * 60 * 1000).unref?.();
  }
}
