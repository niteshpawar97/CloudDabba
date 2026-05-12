import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import prisma from '../../database/connection';
// DeploymentStatus values: QUEUED, CLONING, BUILDING, DEPLOYING, LIVE, FAILED, STOPPED
import { AuthService } from './auth.service';
import { GitHubService } from './github.service';
import { DockerService } from './docker.service';
import { NginxService } from './nginx.service';
import { LogService } from './log.service';
import { allocatePort } from '../../shared/utils/port-allocator';
import { broadcastStatus } from '../../infrastructure/websocket/log-stream';
import { AppError } from '../types';
import logger from '../../shared/utils/logger';

export class DeploymentService {
  static async triggerDeploy(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        projectId,
        status: 'QUEUED',
      },
    });

    // Run deploy pipeline async
    this.runPipeline(deployment.id, project.id, userId).catch((err) => {
      logger.error(`Deploy pipeline failed for ${deployment.id}:`, err);
    });

    return deployment;
  }

  private static async runPipeline(deploymentId: string, projectId: string, userId: string) {
    const buildDir = path.join(os.tmpdir(), 'clouddabba', 'builds', deploymentId);
    let containerId: string | undefined;
    let imageTag: string | undefined;

    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error('Project not found');

      // Step 1: Clone or copy from ZIP upload
      await this.updateStatus(deploymentId, 'CLONING');
      const isZipUpload = project.repoUrl.startsWith('zip://');

      if (isZipUpload) {
        // ZIP upload — copy from extracted path
        await LogService.createLog(deploymentId, 'SYSTEM', `Using uploaded project: ${project.repoUrl.replace('zip://', '')}`);
        const zipExtractDir = path.join(os.tmpdir(), 'clouddabba', 'uploads', userId, 'extracted');
        await fs.mkdir(buildDir, { recursive: true });

        // Find the actual source dir (may be inside a subfolder)
        const entries = await fs.readdir(zipExtractDir);
        let sourceDir = zipExtractDir;
        if (entries.length === 1) {
          const stat = await fs.stat(path.join(zipExtractDir, entries[0]));
          if (stat.isDirectory()) sourceDir = path.join(zipExtractDir, entries[0]);
        }

        // Copy files to build dir
        const sourceEntries = await fs.readdir(sourceDir);
        for (const entry of sourceEntries) {
          await fs.cp(path.join(sourceDir, entry), path.join(buildDir, entry), { recursive: true });
        }
        await LogService.createLog(deploymentId, 'SYSTEM', 'Project files ready');
      } else {
        // Git clone
        await LogService.createLog(deploymentId, 'SYSTEM', `Cloning repository: ${project.repoUrl} (branch: ${project.branch})`);

        let pat = '';
        try {
          pat = await AuthService.getDecryptedPAT(userId);
        } catch {
          // No PAT — clone as public repo
        }
        const commitHash = await GitHubService.cloneRepo(pat, project.repoUrl, project.branch, buildDir);

        await prisma.deployment.update({
          where: { id: deploymentId },
          data: { commitHash },
        });
        await LogService.createLog(deploymentId, 'SYSTEM', `Cloned at commit: ${commitHash}`);
      }

      // Step 2: Detect & prepare
      await this.updateStatus(deploymentId, 'BUILDING');
      const detection = await GitHubService.detectProjectType(buildDir);
      const detectedType = detection.type;
      const tsLabel = detection.isTypeScript ? ' [TypeScript]' : '';
      await LogService.createLog(deploymentId, 'SYSTEM', `Detected project type: ${detectedType}${tsLabel} (${detection.reason})`);

      // Hoist subdirectory app to root before building
      if (detection.appDir) {
        await LogService.createLog(deploymentId, 'BUILD', `App found in /${detection.appDir}, hoisting to root for build`);
        await this.hoistSubdirectory(buildDir, detection.appDir);
      }

      // Prefer auto-detection (full filesystem access) over stored type when confident
      const buildType = (detection.confidence !== 'low') ? detectedType : (project.projectType || detectedType);

      // Docker Compose flow — separate from single-container path
      if (buildType === 'DOCKER_COMPOSE') {
        await this.deployCompose(buildDir, project, deploymentId);
        return;
      }

      await DockerService.copyDockerfile(buildDir, buildType);

      // Reorganize fullstack projects into standard backend/ + frontend/ structure
      const buildArgs: Record<string, string> = {};
      const projectConfig = project.envVars as any;

      // Write project env vars to .env files so build-time code (next build,
      // vite build, prisma generate) can read them. Runtime still gets them
      // via container env; this just makes them available during image build.
      const INTERNAL_KEYS = new Set(['backendPath', 'frontendPath']);
      if (projectConfig && typeof projectConfig === 'object') {
        const envLines: string[] = [];
        for (const [k, v] of Object.entries(projectConfig)) {
          if (INTERNAL_KEYS.has(k) || v == null) continue;
          const val = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          envLines.push(`${k}="${val}"`);
        }
        if (envLines.length > 0) {
          const content = envLines.join('\n') + '\n';
          // Write multiple filenames so any framework picks them up
          for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
            await fs.writeFile(path.join(buildDir, name), content, 'utf-8');
          }
          await LogService.createLog(deploymentId, 'BUILD', `Injected ${envLines.length} env var(s) for build`);
        }
      }

      if (buildType === 'FULLSTACK') {
        // Priority: project config > auto-detection > defaults
        const backendPath = projectConfig?.backendPath || detection.structure?.backendPath || 'backend';
        const frontendPath = projectConfig?.frontendPath || detection.structure?.frontendPath || 'frontend';
        await LogService.createLog(deploymentId, 'BUILD', `Fullstack: backend=/${backendPath}, frontend=/${frontendPath}`);

        await this.reorganizeFullstack(buildDir, backendPath, frontendPath);
        await LogService.createLog(deploymentId, 'BUILD', 'Reorganized into standard /backend + /frontend structure');
      }

      // Step 3: Build Docker image
      imageTag = `clouddabba/${project.subdomain}:${deploymentId.slice(0, 8)}`;

      // Framework-friendly build label
      const fwLabels: Record<string, string> = {
        react: 'React', vue: 'Vue', angular: 'Angular', svelte: 'Svelte',
        astro: 'Astro', gatsby: 'Gatsby', solid: 'Solid.js',
        nuxt: 'Nuxt', sveltekit: 'SvelteKit', nextjs: 'Next.js',
        express: 'Express', fastify: 'Fastify', nestjs: 'NestJS',
        koa: 'Koa', hapi: 'Hapi', adonis: 'AdonisJS', restify: 'Restify',
      };
      const fwMatch = detection.reason.match(/^(\w+)/);
      const fwKey = fwMatch ? fwMatch[1].toLowerCase() : null;
      const fwLabel = fwKey && fwLabels[fwKey] ? fwLabels[fwKey] : null;

      await LogService.createLog(deploymentId, 'BUILD',
        `Building ${fwLabel || buildType} app → Docker image: ${imageTag}`);

      const imageId = await DockerService.buildImage(buildDir, imageTag, deploymentId, Object.keys(buildArgs).length > 0 ? buildArgs : undefined);
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { dockerImageId: imageId },
      });
      await LogService.createLog(deploymentId, 'BUILD', 'Docker image built successfully');

      // Step 4: Run container
      await this.updateStatus(deploymentId, 'DEPLOYING');
      const hostPort = await allocatePort();
      const isStatic = ['STATIC_SITE', 'REACT_FRONTEND'].includes(buildType);
      const isFullstack = buildType === 'FULLSTACK';
      // Static/Fullstack = nginx on port 80, others = our allocated port
      const containerPort = (isStatic || isFullstack) ? 80 : hostPort;
      const containerName = `cd-${project.subdomain}-${deploymentId.slice(0, 8)}`;

      // Parse env vars — force PORT so app listens on our port (skip for static/fullstack which use nginx)
      const envVars: Record<string, string> = project.envVars ? { ...(project.envVars as Record<string, string>) } : {};
      if (!isStatic && !isFullstack) {
        envVars['PORT'] = String(hostPort);
        delete envVars['port'];
      }

      // Inject provisioned database URLs
      const proj = project as any;
      if (proj.dbEnabled && proj.dbPasswordEnc && proj.dbName && proj.dbUser) {
        const { decrypt } = await import('./encryption.service');
        const { DatabaseProvisionService } = await import('./database-provision.service');
        envVars['DATABASE_URL'] = DatabaseProvisionService.buildDatabaseUrl(proj.dbUser, decrypt(proj.dbPasswordEnc), proj.dbName);
        await LogService.createLog(deploymentId, 'SYSTEM', `Injected DATABASE_URL (db: ${proj.dbName})`);
      }
      if (proj.redisEnabled && proj.redisDbNumber != null) {
        const { DatabaseProvisionService } = await import('./database-provision.service');
        envVars['REDIS_URL'] = DatabaseProvisionService.buildRedisUrl(proj.redisDbNumber);
        await LogService.createLog(deploymentId, 'SYSTEM', `Injected REDIS_URL (db: ${proj.redisDbNumber})`);
      }
      if (proj.mariadbEnabled && proj.mariadbPasswordEnc && proj.mariadbName && proj.mariadbUser) {
        const { decrypt: dec } = await import('./encryption.service');
        const { DatabaseProvisionService: DbProv } = await import('./database-provision.service');
        envVars['MYSQL_URL'] = DbProv.buildMariadbUrl(proj.mariadbUser, dec(proj.mariadbPasswordEnc), proj.mariadbName);
        await LogService.createLog(deploymentId, 'SYSTEM', `Injected MYSQL_URL (db: ${proj.mariadbName})`);
      }

      const container = await DockerService.createAndStartContainer(
        imageTag,
        containerName,
        hostPort,
        containerPort,
        envVars,
        {
          'clouddabba.project': projectId,
          'clouddabba.deployment': deploymentId,
        }
      );

      containerId = container.id;
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { containerId, containerPort: hostPort },
      });
      await LogService.createLog(deploymentId, 'SYSTEM', `Container started on port ${hostPort}`);

      // Step 5: Stop previous deployment containers
      const previousDeployments = await prisma.deployment.findMany({
        where: {
          projectId,
          status: 'LIVE',
          id: { not: deploymentId },
        },
      });

      for (const prev of previousDeployments) {
        if (prev.containerId) {
          await DockerService.stopContainer(prev.containerId);
          await prisma.deployment.update({
            where: { id: prev.id },
            data: { status: 'STOPPED', finishedAt: new Date() },
          });
        }
      }

      // Step 6: Configure NGINX
      const customDomain = (project as any).customDomain;
      const domainVerified = (project as any).domainVerified;

      if (customDomain && domainVerified) {
        // Custom domain active → subdomain redirects to custom domain
        await NginxService.generateRedirectConfig(project.subdomain, customDomain);
        await NginxService.generateCustomDomainConfig(customDomain, hostPort);
        await LogService.createLog(deploymentId, 'SYSTEM', `Custom domain: ${customDomain} | ${project.subdomain}.${process.env.BASE_DOMAIN} → redirects`);
      } else {
        await NginxService.generateConfig(project.subdomain, hostPort);
        await LogService.createLog(deploymentId, 'SYSTEM', `Subdomain configured: ${project.subdomain}.${process.env.BASE_DOMAIN}`);
      }

      // Step 7: Mark as live
      await this.updateStatus(deploymentId, 'LIVE');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { finishedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'ACTIVE' },
      });

      await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment successful! App is live.');

    } catch (error: any) {
      logger.error(`Deployment ${deploymentId} failed:`, error);
      await LogService.createLog(deploymentId, 'SYSTEM', `Deployment failed: ${error.message}`);
      await this.updateStatus(deploymentId, 'FAILED');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { finishedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });

      // Cleanup on failure
      if (containerId) {
        await DockerService.stopContainer(containerId).catch(() => {});
      }
      if (imageTag) {
        await DockerService.removeImage(imageTag).catch(() => {});
      }
    } finally {
      // Cleanup build directory
      await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Deploy a project that ships its own docker-compose.yml (ERPNext, Frappe,
   * Strapi+DB, etc). We don't build a single image — we hand off to the
   * docker compose CLI under a project-scoped name and then discover which
   * service exposes a public port to route NGINX to.
   */
  private static async deployCompose(buildDir: string, project: any, deploymentId: string) {
    const { spawn } = await import('child_process');
    const composeProjectName = `cd-${project.subdomain}`;

    await LogService.createLog(deploymentId, 'BUILD',
      `Docker Compose project: ${composeProjectName}`);
    await LogService.createLog(deploymentId, 'BUILD',
      `Running: docker compose -p ${composeProjectName} up -d --build`);

    // Tear down any previous compose project with the same name (idempotent redeploy)
    await this.runCompose(['-p', composeProjectName, 'down'], buildDir, deploymentId, true);

    // Build + start
    const upRc = await this.runCompose(
      ['-p', composeProjectName, 'up', '-d', '--build', '--remove-orphans'],
      buildDir,
      deploymentId,
      false,
    );
    if (upRc !== 0) {
      throw new Error(`docker compose up failed with exit code ${upRc}`);
    }

    // Discover the main service's published host port
    await this.updateStatus(deploymentId, 'DEPLOYING');
    const main = await this.discoverComposePort(buildDir, composeProjectName);
    if (!main) {
      throw new Error('Could not find any service with a published port. Ensure at least one service in compose has a `ports:` entry.');
    }
    await LogService.createLog(deploymentId, 'SYSTEM',
      `Detected web service: ${main.service} → host:${main.hostPort}`);

    // Persist for NGINX routing + future teardown
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        containerId: `compose:${composeProjectName}`,
        containerPort: main.hostPort,
      },
    });

    // Wait for the service to actually accept connections before declaring LIVE.
    // Compose apps (ERPNext / Frappe / Strapi) often take 30-90s to bench-init
    // even after the container is "Started", so just trusting `docker ps` gives
    // a 502 the moment a user hits the URL.
    await LogService.createLog(deploymentId, 'SYSTEM',
      `Waiting for ${main.service} to accept connections on 127.0.0.1:${main.hostPort}…`);
    const reachable = await this.waitForPort('127.0.0.1', main.hostPort, 120, deploymentId);
    if (!reachable) {
      await LogService.createLog(deploymentId, 'SYSTEM',
        `Service did not become reachable within 120s. Check container logs: docker logs cd-${project.subdomain}-${main.service}-1`);
      throw new Error(`Service on host:${main.hostPort} did not start in time. The container is up but the app inside isn't listening — usually missing env vars or an in-app crash. Check container logs.`);
    }
    await LogService.createLog(deploymentId, 'SYSTEM', `Service is responding on 127.0.0.1:${main.hostPort}`);

    // Stop previous LIVE deployments for this project (mark stopped)
    const previousDeployments = await prisma.deployment.findMany({
      where: { projectId: project.id, status: 'LIVE', id: { not: deploymentId } },
    });
    for (const prev of previousDeployments) {
      await prisma.deployment.update({
        where: { id: prev.id },
        data: { status: 'STOPPED', finishedAt: new Date() },
      });
    }

    // NGINX config — same logic as single-container path
    const customDomain = project.customDomain;
    const domainVerified = project.domainVerified;
    if (customDomain && domainVerified) {
      await NginxService.generateRedirectConfig(project.subdomain, customDomain);
      await NginxService.generateCustomDomainConfig(customDomain, main.hostPort);
      await LogService.createLog(deploymentId, 'SYSTEM',
        `Custom domain: ${customDomain} → host:${main.hostPort}`);
    } else {
      await NginxService.generateConfig(project.subdomain, main.hostPort);
      await LogService.createLog(deploymentId, 'SYSTEM',
        `Subdomain configured: ${project.subdomain} → host:${main.hostPort}`);
    }

    await this.updateStatus(deploymentId, 'LIVE');
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { finishedAt: new Date() },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'ACTIVE' },
    });
    await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment successful! Compose stack is live.');

    // Spawn function only declared above; reference to avoid unused warning
    void spawn;
  }

  /**
   * Run `docker compose <args>` in cwd, stream output to deployment logs.
   * Returns the process exit code.
   */
  private static async runCompose(
    args: string[],
    cwd: string,
    deploymentId: string,
    silent: boolean,
  ): Promise<number> {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('docker', ['compose', ...args], { cwd });

      const emit = (chunk: Buffer) => {
        if (silent) return;
        const text = chunk.toString();
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) LogService.streamLog(deploymentId, 'BUILD', trimmed);
        }
      };

      proc.stdout.on('data', emit);
      proc.stderr.on('data', emit);
      proc.on('close', (code: number | null) => resolve(code ?? 1));
      proc.on('error', () => resolve(1));
    });
  }

  /**
   * Poll a TCP port until something accepts a connection, or timeout.
   * Used for compose deploys where the container starts fast but the app
   * inside (Frappe, Rails, JVM) needs time to bind a listener.
   */
  private static async waitForPort(
    host: string,
    port: number,
    timeoutSec: number,
    deploymentId: string,
  ): Promise<boolean> {
    const net = await import('net');
    const start = Date.now();
    let attempt = 0;
    while (Date.now() - start < timeoutSec * 1000) {
      attempt++;
      const ok = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => { socket.destroy(); resolve(false); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
      });
      if (ok) return true;
      if (attempt % 5 === 0) {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        await LogService.createLog(deploymentId, 'SYSTEM', `Still waiting (${elapsed}s elapsed, attempt ${attempt})…`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  /**
   * Pick a "main" service from the compose project and return its host port.
   * Strategy:
   *   1. Prefer services named like a web layer (frontend/web/app/nginx/proxy/traefik).
   *   2. Else prefer one with a published container port matching 80 / 8080 / 3000 / 5000 / 8000.
   *   3. Else the first service that has any published port.
   */
  private static async discoverComposePort(
    cwd: string,
    composeProjectName: string,
  ): Promise<{ service: string; hostPort: number } | null> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);

    const { stdout } = await exec('docker', [
      'ps',
      '--filter', `label=com.docker.compose.project=${composeProjectName}`,
      '--format', '{{.Names}}|{{.Label "com.docker.compose.service"}}|{{.Ports}}',
    ], { cwd });

    type Entry = { service: string; hostPort: number; containerPort: number };
    const entries: Entry[] = [];
    for (const line of stdout.split('\n')) {
      const [, service, portsStr] = line.split('|');
      if (!service || !portsStr) continue;
      // Examples: "0.0.0.0:8080->8080/tcp, :::8080->8080/tcp"
      const m = portsStr.match(/(?:\d+\.\d+\.\d+\.\d+:|:::)?(\d+)->(\d+)\/tcp/);
      if (!m) continue;
      entries.push({
        service,
        hostPort: parseInt(m[1], 10),
        containerPort: parseInt(m[2], 10),
      });
    }
    if (entries.length === 0) return null;

    const preferNames = /^(frontend|web|app|nginx|proxy|traefik|caddy|api|server|site)$/i;
    const preferPorts = new Set([80, 8080, 3000, 5000, 8000, 4000, 8888]);

    let pick = entries.find((e) => preferNames.test(e.service));
    if (!pick) pick = entries.find((e) => preferPorts.has(e.containerPort));
    if (!pick) pick = entries[0];

    return { service: pick.service, hostPort: pick.hostPort };
  }

  /**
   * Hoist a subdirectory app to root so Dockerfile templates work as-is.
   * e.g., /notes-app/package.json → /package.json
   */
  private static async hoistSubdirectory(buildDir: string, appDir: string) {
    const appPath = path.join(buildDir, appDir);
    const tmpDir = path.join(buildDir, '_clouddabba_hoist');

    // Copy app contents to temp
    await fs.mkdir(tmpDir, { recursive: true });
    const appEntries = await fs.readdir(appPath);
    for (const entry of appEntries) {
      if (entry === 'node_modules') continue;
      await fs.cp(path.join(appPath, entry), path.join(tmpDir, entry), { recursive: true });
    }

    // Clear buildDir (keep .git, Dockerfile, and fullstack support files)
    const allEntries = await fs.readdir(buildDir);
    for (const entry of allEntries) {
      if (entry === '_clouddabba_hoist' || entry === '.git' || entry === 'Dockerfile' || entry.startsWith('fullstack-')) continue;
      await fs.rm(path.join(buildDir, entry), { recursive: true, force: true });
    }

    // Move app contents to root
    const hoistEntries = await fs.readdir(tmpDir);
    for (const entry of hoistEntries) {
      await fs.rename(path.join(tmpDir, entry), path.join(buildDir, entry));
    }

    await fs.rm(tmpDir, { recursive: true, force: true });
    logger.info(`Hoisted /${appDir} to root for building`);
  }

  /**
   * Reorganize any repo structure into standard backend/ + frontend/ layout.
   * Handles: root-backend (backend=".", frontend="client"),
   *          separate-dirs (backend="server", frontend="client"),
   *          monorepo (backend="packages/api", frontend="packages/web"),
   *          already-standard (backend="backend", frontend="frontend") → no-op
   */
  private static async reorganizeFullstack(buildDir: string, backendPath: string, frontendPath: string) {
    // Already in standard structure — skip
    if (backendPath === 'backend' && frontendPath === 'frontend') {
      try {
        await fs.access(path.join(buildDir, 'backend'));
        await fs.access(path.join(buildDir, 'frontend'));
        logger.info('Already standard backend/ + frontend/ structure, skipping reorganization');
        return;
      } catch {}
    }

    const tmpDir = path.join(buildDir, '_clouddabba_tmp');
    const tmpBackend = path.join(tmpDir, 'backend');
    const tmpFrontend = path.join(tmpDir, 'frontend');

    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(tmpBackend, { recursive: true });
    await fs.mkdir(tmpFrontend, { recursive: true });

    const srcFrontend = path.join(buildDir, frontendPath);
    const srcBackend = path.join(buildDir, backendPath);

    // Step 1: Copy frontend (handles nested paths like packages/web)
    const frontendEntries = await fs.readdir(srcFrontend);
    for (const entry of frontendEntries) {
      if (entry === '_clouddabba_tmp' || entry === 'node_modules') continue;
      await fs.cp(path.join(srcFrontend, entry), path.join(tmpFrontend, entry), { recursive: true });
    }

    // Step 2: Copy backend
    const backendEntries = await fs.readdir(srcBackend);
    for (const entry of backendEntries) {
      if (entry === '_clouddabba_tmp' || entry === '.git' || entry === 'node_modules') continue;
      // If backend is root (.) skip the frontend folder and CloudDabba files
      if (backendPath === '.') {
        if (entry === frontendPath || entry === 'Dockerfile' || entry.startsWith('fullstack-')) continue;
      }
      await fs.cp(path.join(srcBackend, entry), path.join(tmpBackend, entry), { recursive: true });
    }

    // Step 3: Clear buildDir (keep .git, Dockerfile, and fullstack support files)
    const allEntries = await fs.readdir(buildDir);
    for (const entry of allEntries) {
      if (entry === '_clouddabba_tmp' || entry === '.git' || entry === 'Dockerfile' || entry.startsWith('fullstack-')) continue;
      await fs.rm(path.join(buildDir, entry), { recursive: true, force: true });
    }

    // Step 4: Move standardized dirs into buildDir
    await fs.rename(tmpBackend, path.join(buildDir, 'backend'));
    await fs.rename(tmpFrontend, path.join(buildDir, 'frontend'));

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });

    logger.info(`Reorganized fullstack: ${backendPath} → /backend, ${frontendPath} → /frontend`);
  }

  private static async updateStatus(deploymentId: string, status: string) {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: status as any },
    });
    broadcastStatus(deploymentId, status);
  }

  static async getDeployment(deploymentId: string, userId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: true },
    });
    if (!deployment) throw new AppError('Deployment not found', 404);
    if (deployment.project.userId !== userId) throw new AppError('Unauthorized', 403);
    return deployment;
  }

  static async listByProject(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404);
    if (project.userId !== userId) throw new AppError('Unauthorized', 403);

    return prisma.deployment.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  static async stopDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);

    if (deployment.containerId) {
      await DockerService.stopOnly(deployment.containerId);
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'STOPPED' as any },
    });

    await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment stopped by user');
    broadcastStatus(deploymentId, 'STOPPED');
  }

  static async startDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);

    if (deployment.containerId) {
      await DockerService.startContainer(deployment.containerId);
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'LIVE' as any },
    });

    await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment started by user');
    broadcastStatus(deploymentId, 'LIVE');
  }

  static async restartDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);

    if (deployment.containerId) {
      await DockerService.restartContainer(deployment.containerId);
    }

    await LogService.createLog(deploymentId, 'SYSTEM', 'Deployment restarted by user');
    broadcastStatus(deploymentId, 'LIVE');
  }
}
