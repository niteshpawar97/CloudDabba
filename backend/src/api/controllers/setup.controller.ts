import { Request, Response, NextFunction } from 'express';
import { SetupService } from '../../core/services/setup.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class SetupController {
  static async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await SetupService.getStatus();
      sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }

  static async completeSetup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SetupService.completeSetup(req.body);
      sendCreated(res, result, 'Platform setup completed');
    } catch (error) {
      next(error);
    }
  }
}
