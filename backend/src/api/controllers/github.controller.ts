import { Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { GitHubService } from '../../core/services/github.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';

async function fetchGitHubJSON(url: string, pat: string, raw = false) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: raw ? 'application/vnd.github.v3.raw' : 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return null;
  return raw ? res.text() : res.json();
}

async function scanPackageJson(owner: string, repo: string, path: string, pat: string) {
  try {
    const pkgPath = path ? `${path}/package.json` : 'package.json';
    const content = await fetchGitHubJSON(
      `https://api.github.com/repos/${owner}/${repo}/contents/${pkgPath}`,
      pat, true
    );
    if (!content) return null;
    const pkg = JSON.parse(content as string);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts || {};
    return { deps, scripts, name: pkg.name };
  } catch {
    return null;
  }
}

export class GitHubController {
  static async scanRepo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const pat = await AuthService.getDecryptedPAT(req.user!.id);

      const detection: any = {
        type: 'STATIC_SITE',
        confidence: 'low',
        reason: 'Unable to scan',
        structure: null,
      };

      try {
        const contents = await fetchGitHubJSON(
          `https://api.github.com/repos/${owner}/${repo}/contents`,
          pat
        ) as any[];
        if (!contents || !Array.isArray(contents)) throw new Error('Invalid response');

        const fileNames = contents.map((f: any) => f.name);
        const dirs = contents.filter((f: any) => f.type === 'dir').map((f: any) => f.name);

        // --- Check Dockerfile ---
        if (fileNames.includes('Dockerfile')) {
          detection.type = 'CUSTOM_DOCKERFILE';
          detection.confidence = 'high';
          detection.reason = 'Dockerfile found in root';
        }
        // --- Check root package.json ---
        else if (fileNames.includes('package.json')) {
          const rootPkg = await scanPackageJson(owner, repo, '', pat);
          if (rootPkg) {
            const { deps, scripts } = rootPkg;

            // Next.js
            if (deps['next'] || fileNames.includes('next.config.js') || fileNames.includes('next.config.mjs') || fileNames.includes('next.config.ts')) {
              detection.type = 'NEXTJS_APP';
              detection.confidence = 'high';
              detection.reason = `Next.js ${deps['next'] || ''} detected`;
            }
            // React (no backend framework) = pure frontend
            else if ((deps['react'] || deps['react-dom']) && !deps['express'] && !deps['fastify'] && !deps['@nestjs/core']) {
              const hasVite = deps['vite'] || deps['@vitejs/plugin-react'];
              detection.type = 'REACT_FRONTEND';
              detection.confidence = 'high';
              detection.reason = hasVite ? 'React + Vite' : 'React app';
            }
            // Backend framework + has frontend folder = FULLSTACK (root=backend, subfolder=frontend)
            else if ((deps['express'] || deps['fastify'] || deps['@nestjs/core']) &&
                     dirs.some((d: string) => ['client', 'frontend', 'web', 'ui', 'app', 'public', 'views'].includes(d))) {
              const frontendDir = dirs.find((d: string) => ['client', 'frontend', 'web', 'ui'].includes(d));
              const framework = deps['express'] ? 'Express' : deps['fastify'] ? 'Fastify' : 'NestJS';
              detection.type = 'FULLSTACK';
              detection.confidence = 'high';
              detection.reason = `${framework} + frontend in /${frontendDir || 'subfolder'}`;
              detection.structure = {
                pattern: 'root-backend',
                backendPath: '.',
                frontendPath: frontendDir || 'client',
                backendFramework: framework.toLowerCase(),
                frontendFramework: null,
              };

              // Scan frontend subfolder for React/Next etc
              if (frontendDir) {
                const frontPkg = await scanPackageJson(owner, repo, frontendDir, pat);
                if (frontPkg?.deps['next']) {
                  detection.structure.frontendFramework = 'nextjs';
                } else if (frontPkg?.deps['react']) {
                  detection.structure.frontendFramework = frontPkg.deps['vite'] ? 'react-vite' : 'react';
                }
              }
            }
            // Pure backend
            else if (deps['express'] || deps['fastify'] || deps['koa'] || deps['@nestjs/core']) {
              const framework = deps['express'] ? 'Express' : deps['fastify'] ? 'Fastify' : deps['@nestjs/core'] ? 'NestJS' : 'Node.js';
              detection.type = 'NODE_BACKEND';
              detection.confidence = 'high';
              detection.reason = `${framework} backend`;
            }
            // Has start script = probably Node
            else if (scripts['start'] || scripts['dev']) {
              detection.type = 'NODE_BACKEND';
              detection.confidence = 'medium';
              detection.reason = 'Node.js project with start script';
            }
          }
        }

        // --- Check for separate /backend + /frontend dirs ---
        if (detection.type === 'STATIC_SITE' || detection.confidence === 'low') {
          const backendDir = dirs.find((d: string) => ['backend', 'server', 'api'].includes(d));
          const frontendDir = dirs.find((d: string) => ['frontend', 'client', 'web', 'ui', 'app'].includes(d));

          if (backendDir && frontendDir) {
            detection.type = 'FULLSTACK';
            detection.confidence = 'high';
            detection.reason = `/${backendDir} + /${frontendDir} directories`;
            detection.structure = {
              pattern: 'separate-dirs',
              backendPath: backendDir,
              frontendPath: frontendDir,
              backendFramework: null,
              frontendFramework: null,
            };

            // Scan each subfolder
            const [backPkg, frontPkg] = await Promise.all([
              scanPackageJson(owner, repo, backendDir, pat),
              scanPackageJson(owner, repo, frontendDir, pat),
            ]);

            if (backPkg?.deps) {
              detection.structure.backendFramework = backPkg.deps['express'] ? 'express' :
                backPkg.deps['fastify'] ? 'fastify' : backPkg.deps['@nestjs/core'] ? 'nestjs' : 'node';
            }
            if (frontPkg?.deps) {
              detection.structure.frontendFramework = frontPkg.deps['next'] ? 'nextjs' :
                frontPkg.deps['react'] ? (frontPkg.deps['vite'] ? 'react-vite' : 'react') : 'unknown';
            }

            detection.reason = `/${backendDir} (${detection.structure.backendFramework || 'node'}) + /${frontendDir} (${detection.structure.frontendFramework || 'unknown'})`;
          }
          // Only frontend-like dir
          else if (frontendDir && !backendDir) {
            detection.type = 'REACT_FRONTEND';
            detection.confidence = 'medium';
            detection.reason = `Frontend in /${frontendDir}`;
            detection.structure = { pattern: 'subfolder-frontend', frontendPath: frontendDir };
          }
        }

        // --- Fallback: HTML files ---
        if (detection.type === 'STATIC_SITE' && detection.confidence === 'low') {
          if (fileNames.includes('index.html') || fileNames.some((f: string) => f.endsWith('.html'))) {
            detection.confidence = 'high';
            detection.reason = 'HTML files found';
          }
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
