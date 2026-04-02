import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

// Public: GitHub sends POST here on push (no auth, uses webhook secret)
router.post('/github/:projectId', WebhookController.githubWebhook);

export default router;
