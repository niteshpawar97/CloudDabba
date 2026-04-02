import { Router } from 'express';
import { GitHubController } from '../controllers/github.controller';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();

router.get('/repos', authenticate, GitHubController.listRepos);
router.get('/repos/:owner/:repo/branches', authenticate, GitHubController.listBranches);
router.get('/repos/:owner/:repo/scan', authenticate, GitHubController.scanRepo);

export default router;
