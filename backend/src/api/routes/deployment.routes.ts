import { Router } from 'express';
import { DeploymentController } from '../controllers/deployment.controller';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();

router.get('/:id', authenticate, DeploymentController.getDeployment);
router.post('/:id/stop', authenticate, DeploymentController.stopDeployment);
router.post('/:id/start', authenticate, DeploymentController.startDeployment);
router.post('/:id/restart', authenticate, DeploymentController.restartDeployment);
router.get('/:id/logs', authenticate, DeploymentController.getLogs);

export default router;
