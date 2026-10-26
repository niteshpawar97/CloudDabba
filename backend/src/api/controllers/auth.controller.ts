import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { AuditService } from '../../core/services/audit.service';
import { PasswordResetService } from '../../core/services/password-reset.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.signup(name, email, password);
      AuditService.logAnonymous(req, 'auth.signup', email, { type: 'user', id: result.user.id, label: email }, { pendingApproval: result.pendingApproval });
      sendCreated(
        res,
        result,
        result.pendingApproval
          ? 'Account created. An admin must approve it before you can log in.'
          : 'User registered successfully',
      );
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      AuditService.logAnonymous(req, 'auth.login', email, { type: 'user', id: result.user.id, label: email });
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      AuditService.logAnonymous(req, 'auth.login_failed', req.body?.email, {}, { reason: (error as any)?.message });
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const { emailed } = await PasswordResetService.requestReset(email);
      AuditService.logAnonymous(req, 'auth.password_reset_requested', email, {}, { emailed });
      // Same answer whether or not the account exists
      sendSuccess(res, null, 'If that email is registered, a reset link has been sent.');
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      const user = await PasswordResetService.reset(token, password);
      AuditService.logAnonymous(req, 'auth.password_reset_completed', user.email, { type: 'user', id: user.id, label: user.email });
      sendSuccess(res, null, 'Password updated. You can now sign in.');
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
