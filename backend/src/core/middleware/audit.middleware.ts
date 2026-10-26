import { Response, NextFunction } from 'express';
import prisma from '../../database/connection';
import { AuthRequest } from '../types';
import { AuditService, AuditTarget } from '../services/audit.service';

type Describe = (req: AuthRequest) => { target?: AuditTarget; meta?: Record<string, unknown> };

/** Human-readable label for a target, resolved BEFORE the handler runs (it may delete the row). */
async function labelFor(t: AuditTarget): Promise<string | undefined> {
  if (t.label || !t.id) return t.label;
  try {
    if (t.type === 'user') return (await prisma.user.findUnique({ where: { id: t.id }, select: { email: true } }))?.email;
    if (t.type === 'project') return (await prisma.project.findUnique({ where: { id: t.id }, select: { name: true } }))?.name;
    if (t.type === 'deployment') {
      const d = await prisma.deployment.findUnique({ where: { id: t.id }, select: { project: { select: { name: true } } } });
      return d?.project.name;
    }
  } catch { /* label is best-effort */ }
  return undefined;
}

/**
 * Route-level audit hook: records `action` only when the request succeeds (status < 400).
 * `describe` must only return non-secret fields (never passwords, tokens or env values).
 */
export function audit(action: string, describe?: Describe) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const d = describe?.(req) || {};
    const target = d.target || {};
    const label = labelFor(target);
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      label.then((l) => AuditService.log(req, action, { ...target, label: l }, d.meta));
    });
    next();
  };
}

export const userTarget = (req: AuthRequest) => ({ target: { type: 'user', id: req.params.id as string } });
export const projectTarget = (req: AuthRequest) => ({ target: { type: 'project', id: req.params.id as string } });
export const deploymentTarget = (req: AuthRequest) => ({ target: { type: 'deployment', id: req.params.id as string } });
