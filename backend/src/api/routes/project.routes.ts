import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { DeploymentController } from '../controllers/deployment.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { DomainController } from '../controllers/domain.controller';
import { ResourceController } from '../controllers/resource.controller';
import { DatabaseController } from '../controllers/database.controller';
import { createProjectValidator, updateProjectValidator, envVarsValidator } from '../validators/project.validator';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { deployLimiter } from '../../core/middleware/rate-limit.middleware';
import { audit, projectTarget } from '../../core/middleware/audit.middleware';
import { BackupController } from '../controllers/backup.controller';

const router = Router();

// Project CRUD
router.post('/', authenticate, audit('project.create'), createProjectValidator, validate, ProjectController.create);
router.get('/', authenticate, ProjectController.list);
router.get('/:id', authenticate, ProjectController.getById);
router.put('/:id', authenticate, updateProjectValidator, validate, ProjectController.update);
router.delete('/:id', authenticate, audit('project.delete', projectTarget), ProjectController.delete);
router.put('/:id/env', authenticate, audit('project.env_update', projectTarget), envVarsValidator, validate, ProjectController.updateEnvVars);
router.put('/:id/subdomain', authenticate, ProjectController.updateSubdomain);
router.post('/:id/transfer', authenticate, audit('project.transfer', (r) => ({ ...projectTarget(r), meta: { to: r.body?.email } })), ProjectController.transferOwnership);

// Check subdomain availability
router.get('/check-subdomain/:subdomain', authenticate, ProjectController.checkSubdomain);

// Deploy & Deployments under project
router.post('/:id/deploy', authenticate, deployLimiter, audit('deployment.trigger', projectTarget), DeploymentController.triggerDeploy);
router.get('/:id/deployments', authenticate, DeploymentController.listByProject);

// Resource monitoring + limits
router.get('/:id/metrics', authenticate, ResourceController.getMetrics);
router.put('/:id/limits', authenticate, audit('project.limits', (r) => ({ ...projectTarget(r), meta: { memoryMb: r.body?.memoryMb, cpu: r.body?.cpu } })), ResourceController.updateLimits);

// Webhook (auto-deploy)
router.get('/:id/webhook', authenticate, WebhookController.getWebhookStatus);
router.post('/:id/webhook', authenticate, WebhookController.enableWebhook);
router.delete('/:id/webhook', authenticate, WebhookController.disableWebhook);

// Custom domain
router.get('/:id/domain', authenticate, DomainController.getDomainStatus);
router.post('/:id/domain', authenticate, audit('project.domain_set', (r) => ({ ...projectTarget(r), meta: { domain: r.body?.customDomain } })), DomainController.setDomain);
router.post('/:id/domain/verify', authenticate, DomainController.verifyDomain);
router.delete('/:id/domain', authenticate, audit('project.domain_remove', projectTarget), DomainController.removeDomain);

// Database provisioning
router.get('/:id/database', authenticate, DatabaseController.getStatus);
router.post('/:id/database/postgres', authenticate, audit('database.enable', (r) => ({ ...projectTarget(r), meta: { engine: 'postgres' } })), DatabaseController.enablePostgres);

// Backups
router.get('/:id/backups', authenticate, BackupController.list);
router.post('/:id/backups', authenticate, audit('backup.create', (r) => ({ ...projectTarget(r), meta: { engine: r.body?.engine } })), BackupController.create);
router.get('/:id/backups/:backupId/download', authenticate, audit('backup.download', (r) => ({ target: { type: 'backup', id: r.params.backupId as string }, meta: { project: r.params.id } })), BackupController.download);
router.post('/:id/backups/:backupId/restore', authenticate, audit('backup.restore', (r) => ({ ...projectTarget(r), meta: { backupId: r.params.backupId } })), BackupController.restore);
router.delete('/:id/backups/:backupId', authenticate, audit('backup.delete', (r) => ({ target: { type: 'backup', id: r.params.backupId as string }, meta: { project: r.params.id } })), BackupController.remove);
router.delete('/:id/database/postgres', authenticate, audit('database.disable', (r) => ({ ...projectTarget(r), meta: { engine: 'postgres' } })), DatabaseController.disablePostgres);
router.post('/:id/database/redis', authenticate, DatabaseController.enableRedis);
router.delete('/:id/database/redis', authenticate, DatabaseController.disableRedis);
router.post('/:id/database/mariadb', authenticate, audit('database.enable', (r) => ({ ...projectTarget(r), meta: { engine: 'mariadb' } })), DatabaseController.enableMariadb);
router.delete('/:id/database/mariadb', authenticate, audit('database.disable', (r) => ({ ...projectTarget(r), meta: { engine: 'mariadb' } })), DatabaseController.disableMariadb);
router.post('/:id/database/test', authenticate, DatabaseController.testConnection);
router.get('/:id/database/:engine/tables', authenticate, DatabaseController.listTables);
router.get('/:id/database/:engine/tables/:table', authenticate, DatabaseController.getTableRows);

export default router;
