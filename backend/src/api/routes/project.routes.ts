import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { DeploymentController } from '../controllers/deployment.controller';
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

// Deploy & Deployments under project
router.post('/:id/deploy', authenticate, deployLimiter, DeploymentController.triggerDeploy);
router.get('/:id/deployments', authenticate, DeploymentController.listByProject);

export default router;
