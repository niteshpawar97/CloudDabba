import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { signupValidator, loginValidator, githubPatValidator } from '../validators/auth.validator';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authLimiter } from '../../core/middleware/rate-limit.middleware';

const router = Router();

router.post('/signup', authLimiter, signupValidator, validate, AuthController.signup);
router.post('/login', authLimiter, loginValidator, validate, AuthController.login);
router.get('/me', authenticate, AuthController.getProfile);
router.put('/github-pat', authenticate, githubPatValidator, validate, AuthController.storeGitHubPAT);
router.delete('/github-pat', authenticate, AuthController.removeGitHubPAT);

export default router;
