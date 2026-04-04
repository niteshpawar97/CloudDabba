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
