import { Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AuthRequest, AppError } from '../../core/types';
import { sendSuccess } from '../../shared/utils/api-response';
import { GitHubService } from '../../core/services/github.service';
import logger from '../../shared/utils/logger';

const execFileAsync = promisify(execFile);

export class SourceController {
  // Clone public repo (no PAT needed)
  static async clonePublicRepo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { repoUrl, branch } = req.body;
      if (!repoUrl) throw new AppError('Repository URL is required', 400);

      // Validate it's a valid git URL
      if (!repoUrl.match(/^https?:\/\/.+\.git$|^https?:\/\/github\.com\/.+/)) {
        throw new AppError('Invalid repository URL', 400);
      }

      // Try to detect project type from GitHub API (public repos don't need PAT)
      let detection = { type: 'STATIC_SITE', confidence: 'low', reason: 'Unable to scan', structure: null };

      // Extract owner/repo from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (match) {
        const [, owner, repo] = match;
        try {
          const contentsRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents`,
            { headers: { Accept: 'application/vnd.github.v3+json' } }
          );
          if (contentsRes.ok) {
            const contents = (await contentsRes.json()) as any[];
            const fileNames = contents.map((f: any) => f.name);

            if (fileNames.includes('Dockerfile')) {
              detection = { type: 'CUSTOM_DOCKERFILE', confidence: 'high', reason: 'Dockerfile found', structure: null };
            } else if (fileNames.includes('package.json')) {
              const pkgRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
                { headers: { Accept: 'application/vnd.github.v3.raw' } }
              );
              if (pkgRes.ok) {
                const pkg = JSON.parse(await pkgRes.text());
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (deps['next']) detection = { type: 'NEXTJS_APP', confidence: 'high', reason: 'Next.js detected', structure: null };
                else if (deps['nuxt']) detection = { type: 'NODE_BACKEND', confidence: 'high', reason: 'nuxt SSR app', structure: null };
                else if (deps['@sveltejs/kit']) detection = { type: 'NODE_BACKEND', confidence: 'high', reason: 'sveltekit SSR app', structure: null };
                else if (deps['react'] || deps['vue'] || deps['@angular/core'] || deps['svelte'] || deps['solid-js'] || deps['astro'] || deps['gatsby']) {
                  const fw = deps['react'] ? 'react' : deps['vue'] ? 'vue' : deps['@angular/core'] ? 'angular' : deps['svelte'] ? 'svelte' : deps['solid-js'] ? 'solid' : deps['astro'] ? 'astro' : 'gatsby';
                  detection = { type: 'REACT_FRONTEND', confidence: 'high', reason: `${fw} frontend`, structure: null };
                }
                else if (deps['express'] || deps['fastify'] || deps['koa'] || deps['@nestjs/core'] || deps['@hapi/hapi']) {
                  const fw = deps['express'] ? 'express' : deps['fastify'] ? 'fastify' : deps['koa'] ? 'koa' : deps['@nestjs/core'] ? 'nestjs' : 'hapi';
                  detection = { type: 'NODE_BACKEND', confidence: 'high', reason: `${fw} backend`, structure: null };
                }
                else detection = { type: 'NODE_BACKEND', confidence: 'medium', reason: 'Node.js project', structure: null };
              }
            } else {
              // Subdirectory app detection — scan dirs for package.json
              const dirs = contents.filter((f: any) => f.type === 'dir').map((f: any) => f.name);
              const ignoreDirs = ['.git', 'node_modules', '.github', '.vscode', 'dist', 'build', 'out'];
              for (const dir of dirs) {
                if (dir.startsWith('.') || ignoreDirs.includes(dir)) continue;
                const subPkgRes = await fetch(
                  `https://api.github.com/repos/${owner}/${repo}/contents/${dir}/package.json`,
                  { headers: { Accept: 'application/vnd.github.v3.raw' } }
                );
                if (!subPkgRes.ok) continue;
                try {
                  const subPkg = JSON.parse(await subPkgRes.text());
                  const deps = { ...subPkg.dependencies, ...subPkg.devDependencies };
                  if (deps['next']) { detection = { type: 'NEXTJS_APP', confidence: 'high', reason: `Next.js in /${dir}`, structure: null }; break; }
                  if (deps['react'] || deps['vue'] || deps['@angular/core'] || deps['svelte'] || deps['solid-js'] || deps['astro'] || deps['gatsby']) {
                    const fw = deps['react'] ? 'react' : deps['vue'] ? 'vue' : deps['@angular/core'] ? 'angular' : deps['svelte'] ? 'svelte' : deps['solid-js'] ? 'solid' : deps['astro'] ? 'astro' : 'gatsby';
                    const hasVite = deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue'];
                    detection = { type: 'REACT_FRONTEND', confidence: 'high', reason: `${fw}${hasVite ? ' + Vite' : ''} in /${dir}`, structure: null };
                    break;
                  }
                  if (deps['express'] || deps['fastify'] || deps['koa'] || deps['@nestjs/core'] || deps['@hapi/hapi']) {
                    const fw = deps['express'] ? 'express' : deps['fastify'] ? 'fastify' : deps['koa'] ? 'koa' : deps['@nestjs/core'] ? 'nestjs' : 'hapi';
                    detection = { type: 'NODE_BACKEND', confidence: 'high', reason: `${fw} backend in /${dir}`, structure: null };
                    break;
                  }
                } catch {}
              }

              if (detection.confidence === 'low' && (fileNames.includes('index.html') || fileNames.some((f: string) => f.endsWith('.html')))) {
                detection = { type: 'STATIC_SITE', confidence: 'high', reason: 'HTML files found', structure: null };
              }
            }
          }
        } catch {}
      }

      sendSuccess(res, {
        repoUrl: repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`,
        branch: branch || 'main',
        detection,
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload ZIP file
  static async uploadZip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError('No file uploaded', 400);

      const uploadDir = path.join(os.tmpdir(), 'clouddabba', 'uploads', req.user!.id);
      await fs.mkdir(uploadDir, { recursive: true });

      const zipPath = path.join(uploadDir, req.file.originalname);
      await fs.writeFile(zipPath, req.file.buffer);

      // Extract to temp dir to scan
      const extractDir = path.join(uploadDir, 'extracted');
      await fs.rm(extractDir, { recursive: true, force: true });
      await fs.mkdir(extractDir, { recursive: true });

      try {
        await execFileAsync('unzip', ['-o', zipPath, '-d', extractDir], { timeout: 30000 });
      } catch {
        // Try tar if unzip fails
        try {
          await execFileAsync('tar', ['-xf', zipPath, '-C', extractDir], { timeout: 30000 });
        } catch {
          throw new AppError('Failed to extract archive. Supported formats: .zip, .tar.gz', 400);
        }
      }

      // Check if extracted into a single subfolder
      const entries = await fs.readdir(extractDir);
      let scanDir = extractDir;
      if (entries.length === 1) {
        const stat = await fs.stat(path.join(extractDir, entries[0]));
        if (stat.isDirectory()) {
          scanDir = path.join(extractDir, entries[0]);
        }
      }

      // Detect project type
      const detection = await GitHubService.detectProjectType(scanDir);

      // Store the extracted path for later use during deploy
      sendSuccess(res, {
        uploadId: path.basename(uploadDir),
        extractedPath: scanDir,
        fileName: req.file.originalname,
        detection,
      });
    } catch (error) {
      next(error);
    }
  }
}
