import { Router } from 'express';
import authRoutes from './auth.routes';
import githubRoutes from './github.routes';
import projectRoutes from './project.routes';
import deploymentRoutes from './deployment.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/github', githubRoutes);
router.use('/projects', projectRoutes);
router.use('/deployments', deploymentRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'CloudDabba API is running', timestamp: new Date().toISOString() });
});

// Public config (domain info for frontend)
router.get('/config', (_req, res) => {
  const { config } = require('../../shared/config/app.config');
  res.json({
    success: true,
    data: {
      baseDomain: config.domain.base,
      protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http',
    },
  });
});

export default router;
