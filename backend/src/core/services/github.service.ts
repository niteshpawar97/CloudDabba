import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

const execFileAsync = promisify(execFile);

// Common directory name patterns
const FRONTEND_DIRS = ['frontend', 'client', 'web', 'ui', 'app', 'web-app', 'webapp', 'site'];
const BACKEND_DIRS = ['backend', 'server', 'api', 'service', 'services', 'app-server'];
// SSR frameworks need Node.js runtime (not nginx static serving)
const SSR_FRAMEWORKS = ['nuxt', 'sveltekit'];

const FRONTEND_FRAMEWORKS: Record<string, string> = {
  'next': 'nextjs',
  // SSR frameworks MUST be checked before their base frameworks (nuxt before vue, sveltekit before svelte)
  'nuxt': 'nuxt',
  '@sveltejs/kit': 'sveltekit',
  'react': 'react',
  'react-dom': 'react',
  'vue': 'vue',
  '@angular/core': 'angular',
  'svelte': 'svelte',
  'solid-js': 'solid',
  'astro': 'astro',
  'gatsby': 'gatsby',
};
const BACKEND_FRAMEWORKS: Record<string, string> = {
  'express': 'express',
  'fastify': 'fastify',
  'koa': 'koa',
  '@nestjs/core': 'nestjs',
  '@hapi/hapi': 'hapi',
  'hapi': 'hapi',
  'restify': 'restify',
  'adonis': 'adonis',
  '@adonisjs/core': 'adonis',
};

interface DetectionResult {
  type: string;
  confidence: string;
  reason: string;
  isTypeScript?: boolean;
  appDir?: string; // subdirectory containing the app (e.g., 'notes-app')
  structure?: {
    pattern: string;
    backendPath: string;
    frontendPath: string;
    backendFramework: string | null;
    frontendFramework: string | null;
  };
}

export class GitHubService {
  static async listRepos(pat: string) {
    const repos: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new AppError('Invalid GitHub PAT', 401);
        }
        throw new AppError(`GitHub API error: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as any[];
      if (data.length === 0) break;

      repos.push(
        ...data.map((r: any) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          description: r.description,
          language: r.language,
          defaultBranch: r.default_branch,
          updatedAt: r.updated_at,
          cloneUrl: r.clone_url,
          htmlUrl: r.html_url,
        }))
      );

      if ((data as any[]).length < perPage) break;
      page++;
    }

    return repos;
  }

  static async listBranches(pat: string, owner: string, repo: string) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new AppError(`Failed to fetch branches: ${response.statusText}`, response.status);
    }

    const data = (await response.json()) as any[];
    return data.map((b: any) => ({
      name: b.name,
      sha: b.commit.sha,
    }));
  }

  static async cloneRepo(pat: string, repoUrl: string, branch: string, destPath: string): Promise<string> {
    await fs.mkdir(destPath, { recursive: true });

    const authenticatedUrl = pat ? repoUrl.replace('https://', `https://${pat}@`) : repoUrl;

    try {
      await execFileAsync('git', [
        'clone',
        '--branch', branch,
        '--depth', '1',
        authenticatedUrl,
        destPath,
      ], { timeout: 120000 });

      logger.info(`Cloned repo to ${destPath}`);

      const { stdout: hash } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: destPath });
      return hash.trim();
    } catch (error: any) {
      throw new AppError(`Failed to clone repository: ${error.message}`, 500);
    }
  }

  /**
   * Detect project type from cloned repository on disk.
   * Handles: TypeScript, monorepo, fullstack, various frameworks.
   */
  static async detectProjectType(repoPath: string): Promise<DetectionResult> {
    const entries = await fs.readdir(repoPath);

    // Check for custom Dockerfile first
    if (entries.includes('Dockerfile')) {
      return { type: 'CUSTOM_DOCKERFILE', confidence: 'high', reason: 'Dockerfile found in root' };
    }

    // Detect TypeScript
    const isTypeScript = entries.includes('tsconfig.json') ||
      entries.includes('tsconfig.build.json') ||
      entries.some(f => f.endsWith('.ts') && f !== 'next-env.d.ts');

    // Check for fullstack: separate backend/ + frontend/ dirs
    const backendDir = entries.find(e => BACKEND_DIRS.includes(e));
    const frontendDir = entries.find(e => FRONTEND_DIRS.includes(e));

    if (backendDir && frontendDir) {
      const backendFramework = await this.detectFrameworkInDir(path.join(repoPath, backendDir), 'backend');
      const frontendFramework = await this.detectFrameworkInDir(path.join(repoPath, frontendDir), 'frontend');
      const hasTsBackend = await this.hasTypeScript(path.join(repoPath, backendDir));

      return {
        type: 'FULLSTACK',
        confidence: 'high',
        reason: `/${backendDir} (${backendFramework || 'node'}) + /${frontendDir} (${frontendFramework || 'unknown'})`,
        isTypeScript: hasTsBackend,
        structure: {
          pattern: 'separate-dirs',
          backendPath: backendDir,
          frontendPath: frontendDir,
          backendFramework,
          frontendFramework,
        },
      };
    }

    // Check root package.json
    if (entries.includes('package.json')) {
      try {
        const pkgContent = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        // Check for Next.js
        if (allDeps['next'] || entries.includes('next.config.js') || entries.includes('next.config.mjs') || entries.includes('next.config.ts')) {
          return { type: 'NEXTJS_APP', confidence: 'high', reason: `Next.js ${allDeps['next'] || ''} detected`, isTypeScript };
        }

        // Detect backend framework
        const detectedBackend = this.findFramework(allDeps, BACKEND_FRAMEWORKS);
        // Detect frontend framework
        const detectedFrontend = this.findFramework(allDeps, FRONTEND_FRAMEWORKS);

        // Backend + frontend subfolder = FULLSTACK (root-backend pattern)
        if (detectedBackend) {
          const clientDir = entries.find(e => FRONTEND_DIRS.includes(e));
          if (clientDir) {
            const clientFramework = await this.detectFrameworkInDir(path.join(repoPath, clientDir), 'frontend');
            return {
              type: 'FULLSTACK',
              confidence: 'high',
              reason: `${detectedBackend} backend + frontend in /${clientDir}`,
              isTypeScript,
              structure: {
                pattern: 'root-backend',
                backendPath: '.',
                frontendPath: clientDir,
                backendFramework: detectedBackend,
                frontendFramework: clientFramework,
              },
            };
          }

          // Pure backend
          return {
            type: 'NODE_BACKEND',
            confidence: 'high',
            reason: `${detectedBackend} backend detected`,
            isTypeScript,
          };
        }

        // Pure frontend (React, Vue, Svelte, etc.)
        if (detectedFrontend && detectedFrontend !== 'nextjs') {
          // SSR frameworks (Nuxt, SvelteKit) need Node.js runtime, not nginx static
          if (SSR_FRAMEWORKS.includes(detectedFrontend)) {
            return {
              type: 'NODE_BACKEND',
              confidence: 'high',
              reason: `${detectedFrontend} SSR app`,
              isTypeScript,
            };
          }
          const hasVite = allDeps['vite'] || allDeps['@vitejs/plugin-react'] || allDeps['@vitejs/plugin-vue'];
          const hasCRA = allDeps['react-scripts'];
          return {
            type: 'REACT_FRONTEND',
            confidence: 'high',
            reason: `${detectedFrontend}${hasVite ? ' + Vite' : hasCRA ? ' + CRA' : ''} frontend`,
            isTypeScript,
          };
        }

        // Monorepo detection (workspaces)
        if (pkg.workspaces) {
          const monorepoResult = await this.detectMonorepo(repoPath, pkg, isTypeScript);
          if (monorepoResult) return monorepoResult;
        }

        // Has start script = Node backend
        if (scripts['start'] || scripts['dev'] || scripts['serve']) {
          return {
            type: 'NODE_BACKEND',
            confidence: 'medium',
            reason: 'Node.js project with start script',
            isTypeScript,
          };
        }

        return { type: 'NODE_BACKEND', confidence: 'low', reason: 'package.json found, assumed Node.js', isTypeScript };
      } catch {}
    }

    // Subdirectory app detection — scan for package.json in subdirs
    const subdirResult = await this.detectSubdirectoryApp(repoPath, entries);
    if (subdirResult) return subdirResult;

    // Check for static files
    if (entries.includes('index.html') || entries.some(f => f.endsWith('.html'))) {
      return { type: 'STATIC_SITE', confidence: 'high', reason: 'HTML files found' };
    }

    return { type: 'STATIC_SITE', confidence: 'low', reason: 'No recognizable project structure' };
  }

  /**
   * Detect framework from a subdirectory's package.json
   */
  private static async detectFrameworkInDir(dirPath: string, role: 'frontend' | 'backend'): Promise<string | null> {
    try {
      const pkgPath = path.join(dirPath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const frameworks = role === 'frontend' ? FRONTEND_FRAMEWORKS : BACKEND_FRAMEWORKS;
      return this.findFramework(deps, frameworks);
    } catch {
      return null;
    }
  }

  /**
   * Find the first matching framework from dependencies
   */
  private static findFramework(deps: Record<string, string>, frameworks: Record<string, string>): string | null {
    for (const [pkg, name] of Object.entries(frameworks)) {
      if (deps[pkg]) return name;
    }
    return null;
  }

  /**
   * Check if a directory has TypeScript
   */
  private static async hasTypeScript(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath);
      if (entries.includes('tsconfig.json')) return true;
      const pkgPath = path.join(dirPath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !!(deps['typescript'] || deps['ts-node']);
    } catch {
      return false;
    }
  }

  /**
   * Scan subdirectories for a deployable app when no root package.json exists.
   * Handles repos like: /notes-app/package.json (React), /app/package.json (Express), etc.
   */
  private static async detectSubdirectoryApp(repoPath: string, entries: string[]): Promise<DetectionResult | null> {
    const ignoreDirs = ['.git', 'node_modules', '.github', '.vscode', '__pycache__', '.next', 'dist', 'build', 'out'];
    const candidates: { dir: string; result: DetectionResult }[] = [];

    for (const entry of entries) {
      if (entry.startsWith('.') || ignoreDirs.includes(entry)) continue;

      const dirPath = path.join(repoPath, entry);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) continue;

        const pkgPath = path.join(dirPath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        const subdirEntries = await fs.readdir(dirPath);
        const isTS = subdirEntries.includes('tsconfig.json') ||
          subdirEntries.some((f: string) => f.endsWith('.ts') && f !== 'next-env.d.ts');

        // Next.js
        if (allDeps['next'] || subdirEntries.includes('next.config.js') || subdirEntries.includes('next.config.mjs') || subdirEntries.includes('next.config.ts')) {
          candidates.push({ dir: entry, result: { type: 'NEXTJS_APP', confidence: 'high', reason: `Next.js in /${entry}`, isTypeScript: isTS, appDir: entry } });
          continue;
        }

        // Frontend framework
        const detectedFrontend = this.findFramework(allDeps, FRONTEND_FRAMEWORKS);
        if (detectedFrontend && detectedFrontend !== 'nextjs') {
          if (SSR_FRAMEWORKS.includes(detectedFrontend)) {
            candidates.push({ dir: entry, result: { type: 'NODE_BACKEND', confidence: 'high', reason: `${detectedFrontend} SSR in /${entry}`, isTypeScript: isTS, appDir: entry } });
          } else {
            const hasVite = allDeps['vite'] || allDeps['@vitejs/plugin-react'] || allDeps['@vitejs/plugin-vue'];
            const hasCRA = allDeps['react-scripts'];
            candidates.push({ dir: entry, result: { type: 'REACT_FRONTEND', confidence: 'high', reason: `${detectedFrontend}${hasVite ? ' + Vite' : hasCRA ? ' + CRA' : ''} in /${entry}`, isTypeScript: isTS, appDir: entry } });
          }
          continue;
        }

        // Backend framework
        const detectedBackend = this.findFramework(allDeps, BACKEND_FRAMEWORKS);
        if (detectedBackend) {
          candidates.push({ dir: entry, result: { type: 'NODE_BACKEND', confidence: 'high', reason: `${detectedBackend} backend in /${entry}`, isTypeScript: isTS, appDir: entry } });
          continue;
        }

        // Has build/start script
        if (scripts['build'] || scripts['start'] || scripts['dev']) {
          candidates.push({ dir: entry, result: { type: 'NODE_BACKEND', confidence: 'medium', reason: `Node.js app in /${entry}`, isTypeScript: isTS, appDir: entry } });
        }
      } catch {
        continue;
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].result;

    // Multiple candidates — pick highest confidence, prefer frontend over backend
    const highConf = candidates.find(c => c.result.confidence === 'high');
    return highConf?.result || candidates[0].result;
  }

  /**
   * Detect monorepo with workspaces → find backend + frontend packages
   */
  private static async detectMonorepo(repoPath: string, pkg: any, isTypeScript: boolean): Promise<DetectionResult | null> {
    try {
      const workspaces: string[] = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : (pkg.workspaces?.packages || []);

      // Resolve workspace patterns to actual directories
      const allDirs: string[] = [];
      for (const ws of workspaces) {
        const wsBase = ws.replace('/*', '').replace('/**', '');
        try {
          const entries = await fs.readdir(path.join(repoPath, wsBase), { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              allDirs.push(path.join(wsBase, entry.name));
            }
          }
        } catch {
          // Direct workspace path (not a glob)
          allDirs.push(wsBase);
        }
      }

      let backendPath: string | null = null;
      let frontendPath: string | null = null;
      let backendFramework: string | null = null;
      let frontendFramework: string | null = null;

      for (const dir of allDirs) {
        const dirName = path.basename(dir).toLowerCase();
        const fullPath = path.join(repoPath, dir);

        // Check if it's a backend or frontend package
        if (BACKEND_DIRS.includes(dirName) || dirName.includes('api') || dirName.includes('server')) {
          backendPath = dir;
          backendFramework = await this.detectFrameworkInDir(fullPath, 'backend');
        } else if (FRONTEND_DIRS.includes(dirName) || dirName.includes('web') || dirName.includes('client')) {
          frontendPath = dir;
          frontendFramework = await this.detectFrameworkInDir(fullPath, 'frontend');
        }
      }

      if (backendPath && frontendPath) {
        return {
          type: 'FULLSTACK',
          confidence: 'high',
          reason: `Monorepo: /${backendPath} (${backendFramework || 'node'}) + /${frontendPath} (${frontendFramework || 'unknown'})`,
          isTypeScript,
          structure: {
            pattern: 'monorepo',
            backendPath,
            frontendPath,
            backendFramework,
            frontendFramework,
          },
        };
      }
    } catch {}

    return null;
  }
}
