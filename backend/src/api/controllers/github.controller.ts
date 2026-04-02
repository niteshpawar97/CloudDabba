import { Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { GitHubService } from '../../core/services/github.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';

export class GitHubController {
  static async scanRepo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { owner, repo } = req.params;
      const pat = await AuthService.getDecryptedPAT(req.user!.id);

      // Fetch package.json from GitHub API directly (no clone needed)
      let detection = { type: 'STATIC_SITE', confidence: 'low', reason: 'Unable to scan' };

      try {
        // Get repo contents
        const contentsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents`,
          { headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3+json' } }
        );
        const contents = (await contentsRes.json()) as any[];
        const fileNames = contents.map((f: any) => f.name);

        // Check Dockerfile
        if (fileNames.includes('Dockerfile')) {
          detection = { type: 'CUSTOM_DOCKERFILE', confidence: 'high', reason: 'Dockerfile found in root' };
        }
        // Check package.json
        else if (fileNames.includes('package.json')) {
          const pkgRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
            { headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github.v3.raw' } }
          );
          const pkgContent = await pkgRes.text();
          const pkg = JSON.parse(pkgContent);
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          const scripts = pkg.scripts || {};

          if (allDeps['next'] || fileNames.includes('next.config.js') || fileNames.includes('next.config.mjs') || fileNames.includes('next.config.ts')) {
            detection = { type: 'NEXTJS_APP', confidence: 'high', reason: `Next.js ${allDeps['next'] || ''} detected` };
          } else if (allDeps['react'] || allDeps['react-dom']) {
            const hasVite = allDeps['vite'] || allDeps['@vitejs/plugin-react'];
            detection = { type: 'REACT_FRONTEND', confidence: 'high', reason: hasVite ? 'React + Vite detected' : 'React app detected' };
          } else if (fileNames.includes('backend') && fileNames.includes('frontend')) {
            detection = { type: 'FULLSTACK', confidence: 'high', reason: '/backend and /frontend directories found' };
          } else if (allDeps['express'] || allDeps['fastify'] || allDeps['koa'] || allDeps['nestjs'] || allDeps['@nestjs/core']) {
            const framework = allDeps['express'] ? 'Express' : allDeps['fastify'] ? 'Fastify' : allDeps['@nestjs/core'] ? 'NestJS' : 'Node.js';
            detection = { type: 'NODE_BACKEND', confidence: 'high', reason: `${framework} backend detected` };
          } else if (scripts['start'] || scripts['dev']) {
            detection = { type: 'NODE_BACKEND', confidence: 'medium', reason: 'Node.js project with start script' };
          }
        }
        // Check for fullstack dirs
        else if (fileNames.includes('backend') && fileNames.includes('frontend')) {
          detection = { type: 'FULLSTACK', confidence: 'high', reason: '/backend and /frontend directories found' };
        }
        // Check for HTML files
        else if (fileNames.includes('index.html') || fileNames.some((f: string) => f.endsWith('.html'))) {
          detection = { type: 'STATIC_SITE', confidence: 'high', reason: 'HTML files found' };
        }
      } catch {}

      sendSuccess(res, detection);
    } catch (error) {
      next(error);
    }
  }

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
