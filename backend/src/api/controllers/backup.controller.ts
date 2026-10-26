import { Response, NextFunction } from 'express';
import { AuthRequest, AppError } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import { BackupService, Engine } from '../../core/services/backup.service';

const engineOf = (v: unknown): Engine => {
  if (v === 'POSTGRES' || v === 'MARIADB') return v;
  throw new AppError('engine must be POSTGRES or MARIADB', 400);
};

export class BackupController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await BackupService.listForProject(req.params.id as string, req.user!.id));
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const row = await BackupService.createForProject(req.params.id as string, req.user!.id, engineOf(req.body?.engine), req.user!.email);
      sendSuccess(res, row, 'Backup started', 202);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { file, name } = await BackupService.getDownload(req.params.backupId as string, { userId: req.user!.id });
      res.download(file, name);
    } catch (error) {
      next(error);
    }
  }

  static async restore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BackupService.restore(req.params.id as string, req.params.backupId as string, req.user!.id, req.user!.email);
      sendSuccess(res, null, 'Restore started. A safety backup of the current data is taken first.', 202);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BackupService.remove(req.params.backupId as string, { userId: req.user!.id });
      sendSuccess(res, null, 'Backup deleted');
    } catch (error) {
      next(error);
    }
  }

  // ---- platform database (admin routes) ----
  static async listPlatform(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await BackupService.listPlatform());
    } catch (error) {
      next(error);
    }
  }

  static async createPlatform(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await BackupService.createPlatform(req.user!.email), 'Platform backup started', 202);
    } catch (error) {
      next(error);
    }
  }

  static async downloadPlatform(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { file, name } = await BackupService.getDownload(req.params.backupId as string, { admin: true });
      res.download(file, name);
    } catch (error) {
      next(error);
    }
  }

  static async removePlatform(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await BackupService.remove(req.params.backupId as string, { admin: true });
      sendSuccess(res, null, 'Backup deleted');
    } catch (error) {
      next(error);
    }
  }
}
