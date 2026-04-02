import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

const execFileAsync = promisify(execFile);

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

    // Insert PAT into URL for private repo access (skip for public repos)
    const authenticatedUrl = pat ? repoUrl.replace('https://', `https://${pat}@`) : repoUrl;

    try {
      const { stdout } = await execFileAsync('git', [
        'clone',
        '--branch', branch,
        '--depth', '1',
        authenticatedUrl,
        destPath,
      ], { timeout: 120000 });

      logger.info(`Cloned repo to ${destPath}`);

      // Get commit hash
      const { stdout: hash } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: destPath });
      return hash.trim();
    } catch (error: any) {
      throw new AppError(`Failed to clone repository: ${error.message}`, 500);
    }
  }

  static async detectProjectType(repoPath: string): Promise<{ type: string; confidence: string; reason: string }> {
    const entries = await fs.readdir(repoPath);

    // Check for custom Dockerfile first
    if (entries.includes('Dockerfile')) {
      return { type: 'CUSTOM_DOCKERFILE', confidence: 'high', reason: 'Dockerfile found in root' };
    }

    // Check for package.json
    if (entries.includes('package.json')) {
      try {
        const pkgContent = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const scripts = pkg.scripts || {};

        // Check for Next.js
        if (allDeps['next']) {
          return { type: 'NEXTJS_APP', confidence: 'high', reason: `Next.js ${allDeps['next']} detected` };
        }

        // Check for Next.js config file
        if (entries.includes('next.config.js') || entries.includes('next.config.mjs') || entries.includes('next.config.ts')) {
          return { type: 'NEXTJS_APP', confidence: 'high', reason: 'next.config found' };
        }

        // Check for React (Vite/CRA)
        if (allDeps['react'] || allDeps['react-dom']) {
          // Check if it's a pure frontend (no server-side code)
          const hasVite = allDeps['vite'] || allDeps['@vitejs/plugin-react'];
          const hasCRA = allDeps['react-scripts'];
          if (hasVite || hasCRA) {
            return { type: 'REACT_FRONTEND', confidence: 'high', reason: hasVite ? 'React + Vite detected' : 'Create React App detected' };
          }
          return { type: 'REACT_FRONTEND', confidence: 'medium', reason: 'React dependencies found' };
        }

        // Check for fullstack (has both backend and frontend dirs)
        if (entries.includes('backend') && entries.includes('frontend')) {
          return { type: 'FULLSTACK', confidence: 'high', reason: '/backend and /frontend directories found' };
        }

        // Check for Express/Fastify/Koa (backend frameworks)
        if (allDeps['express'] || allDeps['fastify'] || allDeps['koa'] || allDeps['hapi'] || allDeps['nestjs']) {
          return { type: 'NODE_BACKEND', confidence: 'high', reason: `${allDeps['express'] ? 'Express' : allDeps['fastify'] ? 'Fastify' : 'Node.js'} backend detected` };
        }

        // Has package.json with start script = Node backend
        if (scripts['start'] || scripts['dev']) {
          return { type: 'NODE_BACKEND', confidence: 'medium', reason: 'Node.js project with start script' };
        }

        return { type: 'NODE_BACKEND', confidence: 'low', reason: 'package.json found, assumed Node.js' };
      } catch {}
    }

    // Check for fullstack directories without root package.json
    if (entries.includes('backend') && entries.includes('frontend')) {
      return { type: 'FULLSTACK', confidence: 'high', reason: '/backend and /frontend directories found' };
    }

    // Check for static files
    if (entries.includes('index.html') || entries.some(f => f.endsWith('.html'))) {
      return { type: 'STATIC_SITE', confidence: 'high', reason: 'HTML files found' };
    }

    return { type: 'STATIC_SITE', confidence: 'low', reason: 'No recognizable project structure' };
  }
}
