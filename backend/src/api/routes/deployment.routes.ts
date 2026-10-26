import { Router } from 'express';
import { DeploymentController } from '../controllers/deployment.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { deployLimiter } from '../../core/middleware/rate-limit.middleware';
import { audit, deploymentTarget } from '../../core/middleware/audit.middleware';

const router = Router();

router.get('/:id', authenticate, DeploymentController.getDeployment);
router.post('/:id/stop', authenticate, audit('deployment.stop', deploymentTarget), DeploymentController.stopDeployment);
router.post('/:id/start', authenticate, DeploymentController.startDeployment);
router.post('/:id/restart', authenticate, DeploymentController.restartDeployment);
router.post('/:id/rollback', authenticate, deployLimiter, audit('deployment.rollback', deploymentTarget), DeploymentController.rollback);
router.get('/:id/logs', authenticate, DeploymentController.getLogs);
router.get('/:id/container-logs', authenticate, DeploymentController.getContainerLogs);
router.get('/:id/stats', authenticate, DeploymentController.getContainerStats);
router.post('/:id/exec', authenticate, DeploymentController.execInContainer);

export default router;
