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

    // Insert PAT into URL for private repo access
    const authenticatedUrl = repoUrl.replace('https://', `https://${pat}@`);

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

  static async detectProjectType(repoPath: string): Promise<string> {
    const entries = await fs.readdir(repoPath);

    // Check for custom Dockerfile first
    if (entries.includes('Dockerfile')) {
      return 'CUSTOM_DOCKERFILE';
    }

    // Check for package.json
    if (entries.includes('package.json')) {
      try {
        const pkgContent = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Check for React
        if (allDeps['react'] || allDeps['react-dom']) {
          return 'REACT_FRONTEND';
        }

        // Check for fullstack (has both backend and frontend dirs)
        if (entries.includes('backend') && entries.includes('frontend')) {
          return 'FULLSTACK';
        }

        return 'NODE_BACKEND';
      } catch {}
    }

    // Check for fullstack directories without root package.json
    if (entries.includes('backend') && entries.includes('frontend')) {
      return 'FULLSTACK';
    }

    // Check for static files (index.html, .html files, etc.)
    if (entries.includes('index.html') || entries.some(f => f.endsWith('.html'))) {
      return 'STATIC_SITE';
    }

    // No package.json, no Dockerfile, no HTML — treat as static site (safest fallback)
    return 'STATIC_SITE';
  }
}
