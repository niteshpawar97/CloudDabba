import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.signup(name, email, password);
      sendCreated(res, result, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getProfile(req.user!.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async storeGitHubPAT(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { pat } = req.body;
      await AuthService.storeGitHubPAT(req.user!.id, pat);
      sendSuccess(res, null, 'GitHub PAT stored successfully');
    } catch (error) {
      next(error);
    }
  }

  static async removeGitHubPAT(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await AuthService.removeGitHubPAT(req.user!.id);
      sendSuccess(res, null, 'GitHub PAT removed');
    } catch (error) {
      next(error);
    }
  }
}
