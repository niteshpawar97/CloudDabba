import { Router } from 'express';
import { SetupController } from '../controllers/setup.controller';
import { setupValidator } from '../validators/setup.validator';
import { validate } from '../../core/middleware/validation.middleware';

const router = Router();

router.get('/status', SetupController.getStatus);
router.post('/complete', setupValidator, validate, SetupController.completeSetup);

export default router;
