export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'fix' | 'feature' | 'improvement';
    title: string;
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.10.0',
    date: '2026-10-26',
    changes: [
      {
        type: 'feature',
        title: 'Database backups',
        description: 'Automatic daily backups of every project PostgreSQL/MariaDB database and of the platform database, with manual backup, download and one-click restore (a safety backup is taken first).',
      },
      {
        type: 'feature',
        title: 'Audit log',
        description: 'Admin > Audit Log records who did what and from where: logins, impersonation, approvals, deletes, deployments, settings and backup actions.',
      },
      {
        type: 'feature',
        title: 'Password reset',
        description: 'Users can reset a forgotten password by email, and admins can generate a one-time reset link from the Users page. Resetting signs out all existing sessions.',
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-26',
    changes: [
      {
        type: 'feature',
        title: 'Docker health monitoring',
        description: 'The admin dashboard now flags a broken Docker daemon (e.g. containerd shim errors) with the exact fix, and lists unhealthy, crash-looping and unexpectedly stopped containers.',
      },
      {
        type: 'feature',
        title: 'Notifications',
        description: 'Get alerts via Slack/Discord webhook, Telegram or email for failed deployments, disk thresholds, unhealthy containers, Docker problems and new signups awaiting approval.',
      },
      {
        type: 'feature',
        title: 'One-click rollback',
        description: 'The last two previous versions of every app are kept and can be restored from Deployment History. Rollback images are protected from automatic cleanup except in a disk emergency.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-26',
    changes: [
      {
        type: 'feature',
        title: 'Resource monitoring',
        description: 'Each project page now shows live CPU, memory and network usage with a 1-hour history, and the admin dashboard lists resource usage across all running projects.',
      },
      {
        type: 'feature',
        title: 'Configurable resource limits',
        description: 'Set memory and CPU limits per project. Changes apply to the running container immediately and persist for future deploys.',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-08',
    changes: [
      {
        type: 'feature',
        title: 'Automatic Docker storage management',
        description: 'Disk usage is monitored: warning at 80%, cleanup at 90%, emergency cleanup at 95%. Only build cache and unused images are removed - running containers, active images and all volumes (databases) are never touched, and nothing runs during a deployment.',
      },
      {
        type: 'feature',
        title: 'Storage dashboard + Safe Cleanup',
        description: 'Admin dashboard now shows disk usage, images, build cache, reclaimable space and cleanup history, with a manual Safe Cleanup button.',
      },
      {
        type: 'improvement',
        title: 'Container log rotation',
        description: 'Deployed containers now cap their logs at 3 x 10 MB so chatty apps cannot fill the disk.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-17',
    changes: [
      {
        type: 'feature',
        title: 'Project ownership transfer',
        description: 'Transfer a project to another registered CloudDabba account by email, right from the project page.',
      },
      {
        type: 'feature',
        title: 'Automatic Docker image cleanup',
        description: 'Unused build images are now cleaned up automatically every 6 hours, and are also removed as soon as a redeploy or project delete makes them obsolete — no more unbounded disk growth.',
      },
      {
        type: 'feature',
        title: 'Per-project database viewer',
        description: 'Browse tables and paginated rows of a project\'s provisioned PostgreSQL or MariaDB database directly from the Databases card.',
      },
      {
        type: 'improvement',
        title: 'Editable environment variables',
        description: 'Environment variables can now be edited or deleted individually, not just added.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-16',
    changes: [
      {
        type: 'feature',
        title: 'One-click install script',
        description: 'install.sh auto-installs Docker, Node, NGINX, PM2, generates secrets, configures SSL, and starts the platform.',
      },
      {
        type: 'feature',
        title: 'Docker single-command setup',
        description: 'Full platform via docker-compose.prod.yml — PostgreSQL, Redis, and CloudDabba in one command.',
      },
      {
        type: 'feature',
        title: 'First-time setup wizard',
        description: 'Browser-based wizard for domain, admin email, and password configuration. Blocks all other routes until setup is complete.',
      },
      {
        type: 'improvement',
        title: 'Enhanced health check',
        description: 'Health endpoint now checks database, Docker, and setup status with detailed per-service results.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04-11',
    changes: [
      {
        type: 'feature',
        title: 'Per-project PostgreSQL databases',
        description: 'Each project can now get its own PostgreSQL database with auto-generated credentials. DATABASE_URL is auto-injected into containers on deploy.',
      },
      {
        type: 'feature',
        title: 'Per-project Redis',
        description: 'Each project can enable Redis with a dedicated database number. REDIS_URL is auto-injected into containers on deploy.',
      },
      {
        type: 'feature',
        title: 'Admin Databases page',
        description: 'New admin panel page showing all provisioned PostgreSQL and Redis databases across all projects.',
      },
      {
        type: 'improvement',
        title: 'Docker network for database access',
        description: 'Deployed containers are automatically connected to the clouddabba Docker network for direct database/Redis access.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-04',
    changes: [
      {
        type: 'feature',
        title: 'Subdirectory app detection',
        description: 'Auto-detect apps when package.json is in a subdirectory (e.g., /notes-app). Scans all subdirs for React, Next.js, Express, and other frameworks.',
      },
      {
        type: 'fix',
        title: 'Smart Detection for subdirectory repos',
        description: 'Frontend scan (GitHub API) and public repo scan now detect frameworks inside subdirectories instead of showing "Unable to scan".',
      },
      {
        type: 'improvement',
        title: 'Auto-detection priority over stored type',
        description: 'Deployment pipeline now prefers auto-detection (high/medium confidence) over the stored project type, preventing mismatched Dockerfile builds.',
      },
      {
        type: 'feature',
        title: 'Admin Changelog section',
        description: 'New admin panel page showing platform update history with version-wise changes.',
      },
      {
        type: 'feature',
        title: 'Subdomain → Custom domain redirect',
        description: 'When a custom domain is verified, the generated subdomain (e.g., app.clouddabba.dev) now 301 redirects to the custom domain. Removing the custom domain restores the subdomain.',
      },
      {
        type: 'fix',
        title: 'CI/CD pipeline fix',
        description: 'Added set -e for fail-fast, GitHub PAT auth for private repo git pull, build output verification, and step-by-step logging.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-04-03',
    changes: [
      {
        type: 'fix',
        title: 'Sidebar fixed position',
        description: 'Fixed sidebar so it stays in place and does not scroll with page content.',
      },
      {
        type: 'improvement',
        title: 'README documentation',
        description: 'Complete README with local setup, VPS production deployment, custom domains, and CI/CD guides.',
      },
      {
        type: 'fix',
        title: 'NGINX file permissions',
        description: 'Use sudo for all NGINX file operations and tmp file + sudo cp for writing configs.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-02',
    changes: [
      {
        type: 'feature',
        title: 'Custom domain support',
        description: 'Projects can now have custom domains with automatic NGINX configuration.',
      },
      {
        type: 'feature',
        title: 'Smart Detection system',
        description: 'Auto-detect project type (React, Next.js, Express, fullstack, static) from repository structure.',
      },
    ],
  },
];
