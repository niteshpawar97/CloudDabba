import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import { ResourceMonitorService } from '../../core/services/resource-monitor.service';

export class ResourceController {
  static async getMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await ResourceMonitorService.getProjectMetrics(req.params.id as string, req.user!.id));
    } catch (error) {
      next(error);
    }
  }

  static async updateLimits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { memoryMb, cpu } = req.body || {};
      const result = await ResourceMonitorService.updateLimits(req.params.id as string, req.user!.id, memoryMb, cpu);
      sendSuccess(res, result, result.note);
    } catch (error) {
      next(error);
    }
  }
}
