import { Router } from 'express';
import multer from 'multer';
import { SourceController } from '../controllers/source.controller';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

router.post('/public-repo', authenticate, SourceController.clonePublicRepo);
router.post('/upload-zip', authenticate, upload.single('file'), SourceController.uploadZip);

export default router;
