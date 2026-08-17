import { Response, NextFunction } from 'express';
import { DatabaseProvisionService } from '../../core/services/database-provision.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';

export class DatabaseController {
  static async getStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = await DatabaseProvisionService.getDbStatus(req.params.id as string, req.user!.id);
      sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }

  static async enablePostgres(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DatabaseProvisionService.enablePostgres(req.params.id as string, req.user!.id);
      sendSuccess(res, result, 'PostgreSQL database created');
    } catch (error) {
      next(error);
    }
  }

  static async disablePostgres(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DatabaseProvisionService.disablePostgres(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'PostgreSQL database removed');
    } catch (error) {
      next(error);
    }
  }

  static async enableRedis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DatabaseProvisionService.enableRedis(req.params.id as string, req.user!.id);
      sendSuccess(res, result, 'Redis database created');
    } catch (error) {
      next(error);
    }
  }

  static async disableRedis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DatabaseProvisionService.disableRedis(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Redis database removed');
    } catch (error) {
      next(error);
    }
  }

  static async enableMariadb(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DatabaseProvisionService.enableMariadb(req.params.id as string, req.user!.id);
      sendSuccess(res, result, 'MariaDB database created');
    } catch (error) {
      next(error);
    }
  }

  static async disableMariadb(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DatabaseProvisionService.disableMariadb(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'MariaDB database removed');
    } catch (error) {
      next(error);
    }
  }

  static async testConnection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DatabaseProvisionService.testConnection(req.params.id as string, req.user!.id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async listTables(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const engine = req.params.engine as 'postgres' | 'mariadb';
      const tables = await DatabaseProvisionService.listTables(req.params.id as string, req.user!.id, engine);
      sendSuccess(res, tables);
    } catch (error) {
      next(error);
    }
  }

  static async getTableRows(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const engine = req.params.engine as 'postgres' | 'mariadb';
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const data = await DatabaseProvisionService.getTableData(
        req.params.id as string,
        req.user!.id,
        engine,
        req.params.table as string,
        { limit, offset }
      );
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
}
