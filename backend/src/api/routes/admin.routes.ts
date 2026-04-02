import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireAdmin } from '../../core/middleware/admin.middleware';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/stats', AdminController.getStats);
router.get('/activity', AdminController.getActivity);

// Users
router.get('/users', AdminController.listUsers);
router.put('/users/:id/role', AdminController.updateUserRole);
router.delete('/users/:id', AdminController.deleteUser);

// Projects & Deployments
router.get('/projects', AdminController.listAllProjects);
router.get('/deployments', AdminController.listAllDeployments);

// Docker Containers
router.get('/containers', AdminController.listContainers);
router.post('/containers/:id/stop', AdminController.stopContainer);

// Docker Images
router.get('/images', AdminController.listImages);
router.delete('/images/:id', AdminController.deleteImage);
router.post('/images/cleanup', AdminController.cleanupImages);

// Settings
router.get('/settings', AdminController.getSettings);

export default router;
