import { Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { GitHubService } from '../../core/services/github.service';
import { AuthRequest } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';

const FRONTEND_DIRS = ['frontend', 'client', 'web', 'ui', 'app', 'web-app', 'webapp', 'site'];
const BACKEND_DIRS = ['backend', 'server', 'api', 'service', 'services', 'app-server'];

const SSR_FRAMEWORKS = ['nuxt', 'sveltekit'];
const FRONTEND_FRAMEWORKS: Record<string, string> = {
  'next': 'nextjs',
  'nuxt': 'nuxt', '@sveltejs/kit': 'sveltekit',
  'react': 'react', 'react-dom': 'react', 'vue': 'vue',
  '@angular/core': 'angular', 'svelte': 'svelte',
  'solid-js': 'solid', 'astro': 'astro', 'gatsby': 'gatsby',
};
const BACKEND_FRAMEWORKS: Record<string, string> = {
  'express': 'express', 'fastify': 'fastify', 'koa': 'koa',
  '@nestjs/core': 'nestjs', '@hapi/hapi': 'hapi', 'hapi': 'hapi',
  'restify': 'restify', '@adonisjs/core': 'adonis',
};

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

async function scanPackageJson(owner: string, repo: string, pkgPath: string, pat: string) {
  try {
    const fullPath = pkgPath ? `${pkgPath}/package.json` : 'package.json';
    const content = await fetchGitHubJSON(
      `https://api.github.com/repos/${owner}/${repo}/contents/${fullPath}`,
      pat, true
    );
    if (!content) return null;
    const pkg = JSON.parse(content as string);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts || {};
    return { deps, scripts, name: pkg.name, workspaces: pkg.workspaces };
  } catch {
    return null;
  }
}

function findFramework(deps: Record<string, string>, frameworks: Record<string, string>): string | null {
  for (const [pkg, name] of Object.entries(frameworks)) {
    if (deps[pkg]) return name;
  }
  return null;
}

export class GitHubController {
  static async scanRepo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;

      let pat = '';
      try {
        pat = await AuthService.getDecryptedPAT(req.user!.id);
      } catch {}

      const detection: any = {
        type: 'STATIC_SITE',
        confidence: 'low',
        reason: 'Unable to scan',
        isTypeScript: false,
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

        // Detect TypeScript
        const isTS = fileNames.includes('tsconfig.json') || fileNames.includes('tsconfig.build.json');
        detection.isTypeScript = isTS;

        // --- Custom Dockerfile ---
        if (fileNames.includes('Dockerfile')) {
          detection.type = 'CUSTOM_DOCKERFILE';
          detection.confidence = 'high';
          detection.reason = 'Dockerfile found in root';
          sendSuccess(res, detection);
          return;
        }

        // --- Check for separate /backend + /frontend dirs ---
        const backendDir = dirs.find((d: string) => BACKEND_DIRS.includes(d));
        const frontendDir = dirs.find((d: string) => FRONTEND_DIRS.includes(d));

        if (backendDir && frontendDir) {
          const [backPkg, frontPkg] = await Promise.all([
            scanPackageJson(owner, repo, backendDir, pat),
            scanPackageJson(owner, repo, frontendDir, pat),
          ]);

          const backFramework = backPkg?.deps ? findFramework(backPkg.deps, BACKEND_FRAMEWORKS) : null;
          const frontFramework = frontPkg?.deps ? findFramework(frontPkg.deps, FRONTEND_FRAMEWORKS) : null;
          const hasTsBackend = backPkg?.deps?.['typescript'] || backPkg?.deps?.['ts-node'];

          detection.type = 'FULLSTACK';
          detection.confidence = 'high';
          detection.isTypeScript = isTS || !!hasTsBackend;
          detection.reason = `/${backendDir} (${backFramework || 'node'}) + /${frontendDir} (${frontFramework || 'unknown'})`;
          detection.structure = {
            pattern: 'separate-dirs',
            backendPath: backendDir,
            frontendPath: frontendDir,
            backendFramework: backFramework,
            frontendFramework: frontFramework,
          };
          sendSuccess(res, detection);
          return;
        }

        // --- Root package.json ---
        if (fileNames.includes('package.json')) {
          const rootPkg = await scanPackageJson(owner, repo, '', pat);
          if (rootPkg) {
            const { deps, scripts } = rootPkg;

            // Next.js
            if (deps['next'] || fileNames.includes('next.config.js') || fileNames.includes('next.config.mjs') || fileNames.includes('next.config.ts')) {
              detection.type = 'NEXTJS_APP';
              detection.confidence = 'high';
              detection.reason = `Next.js ${deps['next'] || ''} detected`;
              sendSuccess(res, detection);
              return;
            }

            const detectedBackend = findFramework(deps, BACKEND_FRAMEWORKS);
            const detectedFrontend = findFramework(deps, FRONTEND_FRAMEWORKS);

            // Backend + frontend subfolder = FULLSTACK (root-backend pattern)
            if (detectedBackend && frontendDir) {
              const frontPkg = await scanPackageJson(owner, repo, frontendDir, pat);
              const frontFramework = frontPkg?.deps ? findFramework(frontPkg.deps, FRONTEND_FRAMEWORKS) : null;

              detection.type = 'FULLSTACK';
              detection.confidence = 'high';
              detection.reason = `${detectedBackend} backend + frontend in /${frontendDir}`;
              detection.structure = {
                pattern: 'root-backend',
                backendPath: '.',
                frontendPath: frontendDir,
                backendFramework: detectedBackend,
                frontendFramework: frontFramework,
              };
              sendSuccess(res, detection);
              return;
            }

            // Monorepo (workspaces)
            if (rootPkg.workspaces) {
              const workspaces: string[] = Array.isArray(rootPkg.workspaces)
                ? rootPkg.workspaces : (rootPkg.workspaces?.packages || []);

              for (const ws of workspaces) {
                const wsBase = ws.replace('/*', '').replace('/**', '');
                if (dirs.includes(wsBase)) {
                  const wsContents = await fetchGitHubJSON(
                    `https://api.github.com/repos/${owner}/${repo}/contents/${wsBase}`,
                    pat
                  ) as any[];

                  if (wsContents && Array.isArray(wsContents)) {
                    const wsDirs = wsContents.filter((f: any) => f.type === 'dir').map((f: any) => f.name);
                    const wsBackend = wsDirs.find((d: string) => BACKEND_DIRS.includes(d) || d.includes('api') || d.includes('server'));
                    const wsFrontend = wsDirs.find((d: string) => FRONTEND_DIRS.includes(d) || d.includes('web') || d.includes('client'));

                    if (wsBackend && wsFrontend) {
                      const [bPkg, fPkg] = await Promise.all([
                        scanPackageJson(owner, repo, `${wsBase}/${wsBackend}`, pat),
                        scanPackageJson(owner, repo, `${wsBase}/${wsFrontend}`, pat),
                      ]);

                      detection.type = 'FULLSTACK';
                      detection.confidence = 'high';
                      detection.reason = `Monorepo: /${wsBase}/${wsBackend} + /${wsBase}/${wsFrontend}`;
                      detection.structure = {
                        pattern: 'monorepo',
                        backendPath: `${wsBase}/${wsBackend}`,
                        frontendPath: `${wsBase}/${wsFrontend}`,
                        backendFramework: bPkg?.deps ? findFramework(bPkg.deps, BACKEND_FRAMEWORKS) : null,
                        frontendFramework: fPkg?.deps ? findFramework(fPkg.deps, FRONTEND_FRAMEWORKS) : null,
                      };
                      sendSuccess(res, detection);
                      return;
                    }
                  }
                }
              }
            }

            // Pure backend
            if (detectedBackend) {
              detection.type = 'NODE_BACKEND';
              detection.confidence = 'high';
              detection.reason = `${detectedBackend} backend detected`;
              sendSuccess(res, detection);
              return;
            }

            // Pure frontend
            if (detectedFrontend && detectedFrontend !== 'nextjs') {
              if (SSR_FRAMEWORKS.includes(detectedFrontend)) {
                detection.type = 'NODE_BACKEND';
                detection.confidence = 'high';
                detection.reason = `${detectedFrontend} SSR app`;
              } else {
                const hasVite = deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue'];
                detection.type = 'REACT_FRONTEND';
                detection.confidence = 'high';
                detection.reason = `${detectedFrontend}${hasVite ? ' + Vite' : ''} frontend`;
              }
              sendSuccess(res, detection);
              return;
            }

            // Has start script
            if (scripts['start'] || scripts['dev']) {
              detection.type = 'NODE_BACKEND';
              detection.confidence = 'medium';
              detection.reason = 'Node.js project with start script';
              sendSuccess(res, detection);
              return;
            }
          }
        }

        // --- Fallback: only frontend dir ---
        if (frontendDir && !backendDir) {
          detection.type = 'REACT_FRONTEND';
          detection.confidence = 'medium';
          detection.reason = `Frontend in /${frontendDir}`;
          detection.structure = { pattern: 'subfolder-frontend', frontendPath: frontendDir };
        }

        // --- Fallback: HTML files ---
        if (detection.confidence === 'low') {
          if (fileNames.includes('index.html') || fileNames.some((f: string) => f.endsWith('.html'))) {
            detection.type = 'STATIC_SITE';
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
