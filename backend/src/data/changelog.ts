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
