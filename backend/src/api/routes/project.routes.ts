import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { DeploymentController } from '../controllers/deployment.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { DomainController } from '../controllers/domain.controller';
import { DatabaseController } from '../controllers/database.controller';
import { createProjectValidator, updateProjectValidator, envVarsValidator } from '../validators/project.validator';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { deployLimiter } from '../../core/middleware/rate-limit.middleware';

const router = Router();

// Project CRUD
router.post('/', authenticate, createProjectValidator, validate, ProjectController.create);
router.get('/', authenticate, ProjectController.list);
router.get('/:id', authenticate, ProjectController.getById);
router.put('/:id', authenticate, updateProjectValidator, validate, ProjectController.update);
router.delete('/:id', authenticate, ProjectController.delete);
router.put('/:id/env', authenticate, envVarsValidator, validate, ProjectController.updateEnvVars);
router.put('/:id/subdomain', authenticate, ProjectController.updateSubdomain);
router.post('/:id/transfer', authenticate, ProjectController.transferOwnership);

// Check subdomain availability
router.get('/check-subdomain/:subdomain', authenticate, ProjectController.checkSubdomain);

// Deploy & Deployments under project
router.post('/:id/deploy', authenticate, deployLimiter, DeploymentController.triggerDeploy);
router.get('/:id/deployments', authenticate, DeploymentController.listByProject);

// Webhook (auto-deploy)
router.get('/:id/webhook', authenticate, WebhookController.getWebhookStatus);
router.post('/:id/webhook', authenticate, WebhookController.enableWebhook);
router.delete('/:id/webhook', authenticate, WebhookController.disableWebhook);

// Custom domain
router.get('/:id/domain', authenticate, DomainController.getDomainStatus);
router.post('/:id/domain', authenticate, DomainController.setDomain);
router.post('/:id/domain/verify', authenticate, DomainController.verifyDomain);
router.delete('/:id/domain', authenticate, DomainController.removeDomain);

// Database provisioning
router.get('/:id/database', authenticate, DatabaseController.getStatus);
router.post('/:id/database/postgres', authenticate, DatabaseController.enablePostgres);
router.delete('/:id/database/postgres', authenticate, DatabaseController.disablePostgres);
router.post('/:id/database/redis', authenticate, DatabaseController.enableRedis);
router.delete('/:id/database/redis', authenticate, DatabaseController.disableRedis);
router.post('/:id/database/mariadb', authenticate, DatabaseController.enableMariadb);
router.delete('/:id/database/mariadb', authenticate, DatabaseController.disableMariadb);
router.post('/:id/database/test', authenticate, DatabaseController.testConnection);
router.get('/:id/database/:engine/tables', authenticate, DatabaseController.listTables);
router.get('/:id/database/:engine/tables/:table', authenticate, DatabaseController.getTableRows);

export default router;
