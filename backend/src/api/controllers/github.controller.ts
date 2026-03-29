import { Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { GitHubService } from '../../core/services/github.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';

export class GitHubController {
  static async listRepos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pat = await AuthService.getDecryptedPAT(req.user!.id);
      const repos = await GitHubService.listRepos(pat);
      sendSuccess(res, repos);
    } catch (error) {
      next(error);
    }
  }

  static async listBranches(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const pat = await AuthService.getDecryptedPAT(req.user!.id);
      const branches = await GitHubService.listBranches(pat, owner, repo);
      sendSuccess(res, branches);
    } catch (error) {
      next(error);
    }
  }
}
