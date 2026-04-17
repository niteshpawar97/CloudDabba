import { Router } from 'express';
import authRoutes from './auth.routes';
import githubRoutes from './github.routes';
import projectRoutes from './project.routes';
import deploymentRoutes from './deployment.routes';
import adminRoutes from './admin.routes';
import sourceRoutes from './source.routes';
import setupRoutes from './setup.routes';
const router = Router();

router.use('/auth', authRoutes);
router.use('/github', githubRoutes);
router.use('/projects', projectRoutes);
router.use('/deployments', deploymentRoutes);
router.use('/admin', adminRoutes);
router.use('/source', sourceRoutes);
router.use('/setup', setupRoutes);

// Health check (detailed)
router.get('/health', async (_req, res) => {
  const checks: Record<string, { status: string; message?: string }> = {};
  let healthy = true;

  // Database
  try {
    const prisma = require('../../database/connection').default;
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy' };
  } catch (e: any) {
    checks.database = { status: 'unhealthy', message: e.message };
    healthy = false;
  }

  // Docker
  try {
    const docker = require('../../infrastructure/docker/docker-client').default;
    await docker.ping();
    checks.docker = { status: 'healthy' };
  } catch (e: any) {
    checks.docker = { status: 'unavailable', message: e.message };
  }

  // Setup
  try {
    const { SetupService } = require('../../core/services/setup.service');
    const isComplete = await SetupService.isSetupComplete();
    checks.setup = { status: isComplete ? 'completed' : 'pending' };
  } catch {
    checks.setup = { status: 'pending' };
  }

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'CloudDabba is running' : 'Some services are degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Public config (domain info for frontend)
router.get('/config', async (_req, res) => {
  const { PlatformConfig } = require('../../core/services/platform-config.service');
  let setupCompleted = false;
  try {
    const { SetupService } = require('../../core/services/setup.service');
    setupCompleted = await SetupService.isSetupComplete();
  } catch {}
  const s = await PlatformConfig.settings();
  res.json({
    success: true,
    data: {
      baseDomain: s.baseDomain,
      platformName: s.platformName,
      allowSignup: s.allowSignup,
      protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http',
      setupCompleted,
    },
  });
});

export default router;
