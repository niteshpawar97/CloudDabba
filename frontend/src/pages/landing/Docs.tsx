import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, BookOpen, Rocket, Package, Database, Globe, Box, Settings, AlertTriangle, Terminal, ExternalLink } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

interface Section {
  id: string;
  title: string;
  icon: any;
}

const SECTIONS: Section[] = [
  { id: 'getting-started', title: 'Getting Started', icon: Rocket },
  { id: 'install-scripts', title: 'Install / Update / Uninstall', icon: Terminal },
  { id: 'deploying-apps', title: 'Deploying Apps', icon: Package },
  { id: 'docker-compose', title: 'Docker Compose Apps', icon: Box },
  { id: 'databases', title: 'Database Provisioning', icon: Database },
  { id: 'custom-domains', title: 'Custom Domains & SSL', icon: Globe },
  { id: 'platform-settings', title: 'Platform Settings', icon: Settings },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: AlertTriangle },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-[#0a0e14] border border-white/[0.06] rounded-lg p-4 my-3 overflow-x-auto text-sm">
      <code className="text-slate-200 font-mono whitespace-pre">{children}</code>
    </pre>
  );
}

function Inline({ children }: { children: string }) {
  return <code className="text-blue-400 bg-white/[0.04] rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>;
}

function H2({ id, children }: { id: string; children: string }) {
  return <h2 id={id} className="text-2xl font-bold text-white mt-12 mb-4 scroll-mt-24">{children}</h2>;
}

function H3({ id, children }: { id?: string; children: any }) {
  return <h3 id={id} className="text-lg font-semibold text-white mt-8 mb-3 scroll-mt-24">{children}</h3>;
}

function P({ children }: { children: any }) {
  return <p className="text-slate-400 leading-relaxed mb-3">{children}</p>;
}

export function Docs() {
  usePageTitle('Documentation');
  const [active, setActive] = useState<string>('getting-started');

  useEffect(() => {
    const onScroll = () => {
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom > 120) {
            setActive(s.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-300">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06080f]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Cloud className="h-7 w-7 text-blue-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              CloudDabba
            </span>
            <span className="ml-2 text-xs text-slate-500 border-l border-white/[0.06] pl-2">Docs</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a href="https://github.com/niteshpawar97/CloudDabba" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4" /> GitHub
            </a>
            <Link to="/login" className="text-slate-400 hover:text-white">Sign In</Link>
            <Link to="/signup" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors text-white">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 self-start">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" /> On this page
          </p>
          <nav className="space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    active === s.id ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.title}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="max-w-3xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white mb-3">CloudDabba Documentation</h1>
            <p className="text-lg text-slate-400">
              Self-hosted PaaS for deploying GitHub repos as Docker containers with auto-generated subdomains, custom domains, and SSL.
            </p>
          </div>

          {/* Getting Started */}
          <H2 id="getting-started">Getting Started</H2>
          <P>CloudDabba runs on any Ubuntu/Debian VPS. One command installs everything — Docker, NGINX, PM2, Postgres, Redis, MariaDB, certbot — and starts the platform.</P>
          <H3>One-line install</H3>
          <Code>{`curl -fsSL https://raw.githubusercontent.com/niteshpawar97/CloudDabba/master/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh`}</Code>
          <P>The installer prompts for a domain (press Enter for IP-only install) and an admin email, then runs ~13 steps with a live progress bar. At the end you get a panel URL — open it in a browser and finish first-time setup via the wizard.</P>

          <H3>System requirements</H3>
          <P>Ubuntu 22.04+ or Debian 12+. Minimum 2 GB RAM, 20 GB disk. Ports <Inline>80</Inline>, <Inline>443</Inline>, <Inline>6050</Inline>, and <Inline>10000-20000</Inline> must be open on both UFW and the cloud provider firewall (AWS Security Group, Oracle Security List, GCP firewall, etc).</P>

          {/* Scripts */}
          <H2 id="install-scripts">Install / Update / Uninstall Scripts</H2>
          <P>Three scripts cover the full lifecycle. All run as <Inline>sudo</Inline> on Ubuntu/Debian, share the same progress-bar UX, and live in the repo root.</P>

          <H3><Inline>install.sh</Inline> — fresh install</H3>
          <Code>{`sudo ./install.sh`}</Code>
          <P>Detects OS, installs Node.js 22 + Docker + NGINX + PM2 + certbot + MariaDB, generates secrets, writes <Inline>backend/.env</Inline>, brings up Postgres + Redis containers, builds backend + frontend, configures NGINX + UFW (opens 80, 443, 6050, 10000-20000), issues SSL via certbot, starts PM2, runs health check.</P>

          <H3><Inline>update.sh</Inline> — pull + rebuild + restart</H3>
          <Code>{`sudo ./update.sh                  # default — master branch, full rebuild
sudo ./update.sh --yes            # non-interactive
sudo ./update.sh --branch develop # test a different branch
sudo ./update.sh --skip-frontend  # backend-only fix
sudo ./update.sh --skip-prisma    # no schema changes`}</Code>
          <P>PM2 restart happens only at the very end, so a failure in any earlier step leaves the previous build running — you never lose what's live.</P>

          <H3><Inline>uninstall.sh</Inline> — clean teardown</H3>
          <Code>{`sudo ./uninstall.sh               # interactive, removes everything
sudo ./uninstall.sh --yes         # non-interactive
sudo ./uninstall.sh --keep-ssl    # preserve Let's Encrypt certs
sudo ./uninstall.sh --keep-mariadb
sudo ./uninstall.sh --keep-docker`}</Code>
          <P>Removes PM2 process, Docker containers + volumes + clouddabba images, NGINX configs, Let's Encrypt certs (optional), MariaDB, UFW rules, and the install directory itself. The Docker daemon, Node.js, nginx, and ufw packages are left alone — they're shared infrastructure.</P>

          {/* Deploying Apps */}
          <H2 id="deploying-apps">Deploying Apps</H2>
          <P>From the dashboard, click <strong className="text-white">Deploy a Project</strong> and follow the 3-step wizard: pick a source, pick a branch, configure & deploy.</P>

          <H3>Supported project types</H3>
          <P>CloudDabba auto-detects the type from your repo contents. Manual override is also available in the wizard.</P>
          <ul className="list-disc list-inside text-slate-400 space-y-1.5 mb-4">
            <li><strong className="text-slate-300">NODE_BACKEND</strong> — Express, NestJS, Fastify, Koa, Hapi, AdonisJS, Nuxt, SvelteKit</li>
            <li><strong className="text-slate-300">REACT_FRONTEND</strong> — React, Vue, Angular, Svelte, Astro, Gatsby, Solid.js (SPA fallback baked in)</li>
            <li><strong className="text-slate-300">NEXTJS_APP</strong> — Next.js standalone mode</li>
            <li><strong className="text-slate-300">STATIC_SITE</strong> — HTML/CSS/JS</li>
            <li><strong className="text-slate-300">FULLSTACK</strong> — backend + frontend in separate dirs</li>
            <li><strong className="text-slate-300">DOCKER_COMPOSE</strong> — multi-service apps like ERPNext, Frappe, Strapi + DB</li>
            <li><strong className="text-slate-300">CUSTOM_DOCKERFILE</strong> — bring your own Dockerfile</li>
          </ul>

          <H3 id="custom-dockerfile-escape-hatch">Custom Dockerfile (escape hatch)</H3>
          <P>
            If auto-detection guesses wrong, or your stack isn't one of the types above, commit a <Inline>Dockerfile</Inline> to the repo root and select <strong className="text-slate-300">Custom Dockerfile</strong> in the wizard — or leave the detected type as-is, since a root <Inline>Dockerfile</Inline> always wins over CloudDabba's own template generation, regardless of what's selected.
          </P>
          <P>Minimal example for a generic Node app:</P>
          <Code>{`FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]`}</Code>
          <ul className="list-disc list-inside text-slate-400 space-y-1.5 mb-4">
            <li><Inline>EXPOSE</Inline> the port your app listens on — CloudDabba reads it to route traffic</li>
            <li>The container must stay running in the foreground (don't daemonize the process)</li>
            <li>Env vars set in the wizard/project page are injected at runtime the same as for auto-detected types</li>
          </ul>

          <H3>Subdirectory apps</H3>
          <P>If the package.json lives in a subdirectory (e.g. <Inline>/notes-app/package.json</Inline>), CloudDabba detects it and hoists the subdirectory to root before building — same as Vercel.</P>

          <H3>Environment variables</H3>
          <P>Set env vars in the deploy wizard or later from the project page. CloudDabba writes them to <Inline>.env</Inline>, <Inline>.env.local</Inline>, <Inline>.env.production</Inline>, and <Inline>.env.production.local</Inline> in the build context, so <Inline>next build</Inline>, <Inline>vite build</Inline>, <Inline>prisma generate</Inline> and other build-time tools can read them. They're also injected into the running container.</P>

          <H3>Auto-deploy on push</H3>
          <P>Project page → Auto-Deploy → Enable. Copy the webhook URL + secret into your GitHub repo's Webhooks settings (Content type: <Inline>application/json</Inline>, event: push). Every push to the deploy branch triggers a new build.</P>

          {/* Docker Compose */}
          <H2 id="docker-compose">Docker Compose Apps</H2>
          <P>For multi-container projects (ERPNext, Frappe, Strapi + Postgres, etc), commit a <Inline>docker-compose.yml</Inline> in the repo root. CloudDabba runs the stack under a project-scoped name and discovers which service to route traffic to.</P>

          <H3>Service auto-discovery</H3>
          <P>CloudDabba picks the "main" service in this order:</P>
          <ol className="list-decimal list-inside text-slate-400 space-y-1.5 mb-4">
            <li>Service named <Inline>frontend</Inline>, <Inline>web</Inline>, <Inline>app</Inline>, <Inline>nginx</Inline>, <Inline>proxy</Inline>, <Inline>traefik</Inline>, <Inline>caddy</Inline>, <Inline>api</Inline>, <Inline>server</Inline>, or <Inline>site</Inline></li>
            <li>Else the service exposing a port in <Inline>[80, 8080, 3000, 5000, 8000, 4000, 8888]</Inline></li>
            <li>Else the first service with any <Inline>ports:</Inline> entry</li>
          </ol>

          <H3>Lifecycle</H3>
          <P>Each redeploy runs <Inline>docker compose down</Inline> then <Inline>docker compose up -d --build --remove-orphans</Inline> under the project's scoped name. Deleting the project tears down the whole stack including named volumes.</P>

          <H3>Tip — avoid port 80 conflicts</H3>
          <P>If your compose binds host port 80 directly (<Inline>"80:80"</Inline>), it'll conflict with CloudDabba's NGINX. Bind to a high port instead: <Inline>"8080:80"</Inline> — CloudDabba will discover and route to it.</P>

          {/* Databases */}
          <H2 id="databases">Database Provisioning</H2>
          <P>Each project can request a dedicated PostgreSQL, MariaDB, and/or Redis instance. Toggle them on in the deploy wizard or on the project page.</P>

          <H3>What gets injected</H3>
          <ul className="list-disc list-inside text-slate-400 space-y-1.5 mb-4">
            <li><Inline>DATABASE_URL</Inline> — for the PostgreSQL instance</li>
            <li><Inline>MYSQL_URL</Inline> — for MariaDB</li>
            <li><Inline>REDIS_URL</Inline> — for the assigned Redis DB number</li>
          </ul>
          <P>Each project gets unique credentials. The connection URL is exposed in the project page (masked with reveal + copy buttons). The <strong className="text-slate-300">Test Connection</strong> button verifies the URL works from inside a deployed container.</P>

          <H3>Admin overview</H3>
          <P>The admin panel at <Inline>/admin/databases</Inline> lists every provisioned database across all projects with delete controls.</P>

          {/* Custom Domains */}
          <H2 id="custom-domains">Custom Domains & SSL</H2>

          <H3>Add a custom domain to a project</H3>
          <P>Project page → Custom Domain section. Enter the domain, CloudDabba shows the DNS records to add. After you set them at your registrar, click <strong className="text-white">Verify DNS</strong>. On success the panel issues an SSL cert via Let's Encrypt, generates the NGINX vhost, and redirects the subdomain to the custom domain.</P>

          <H3>Change the platform's own base domain</H3>
          <P>Admin Settings → Platform Domain & SSL → <strong className="text-white">Change Domain</strong>. The full flow runs in one click: DNS check, DB update, NGINX regenerate with backup/rollback, NGINX reload, certbot --nginx. CORS origins are auto-updated to include the new domain.</P>

          <H3>Wildcard SSL via Cloudflare</H3>
          <P>For <Inline>*.yourdomain.com</Inline> certs (covering all deployed app subdomains), CloudDabba ships built-in Cloudflare DNS-01 support:</P>
          <ol className="list-decimal list-inside text-slate-400 space-y-1.5 mb-4">
            <li>Move your domain's DNS to Cloudflare (free plan works — keep registrar wherever)</li>
            <li>Create a scoped API token: permissions <strong className="text-slate-300">Zone → DNS → Edit</strong> + <strong className="text-slate-300">Zone → Zone → Read</strong></li>
            <li>Admin Settings → Wildcard SSL via Cloudflare → paste token → Save</li>
            <li>Click <strong className="text-white">Install Wildcard</strong> — certbot runs with the DNS-01 challenge, cert covers apex + wildcard, auto-renews via cron</li>
          </ol>

          {/* Settings */}
          <H2 id="platform-settings">Platform Settings</H2>
          <P>Admin Settings is the operational control panel. Settings are split into two categories:</P>

          <H3>Editable (DB-backed, applies in ≤30s)</H3>
          <ul className="list-disc list-inside text-slate-400 space-y-1.5 mb-4">
            <li><strong className="text-slate-300">Platform Name</strong> — branding (browser tab, wizard header, emails)</li>
            <li><strong className="text-slate-300">Base Domain</strong> — main domain (use Change Domain for full NGINX + SSL switch)</li>
            <li><strong className="text-slate-300">Admin Email</strong> + <strong className="text-slate-300">SSL Email</strong></li>
            <li><strong className="text-slate-300">Default Git Branch</strong> — pre-filled when creating projects</li>
            <li><strong className="text-slate-300">Allow Signup</strong> — public vs invite-only</li>
            <li><strong className="text-slate-300">CORS Origins</strong> — dynamic per-request, no restart needed</li>
          </ul>

          <H3>Infrastructure (.env, restart required)</H3>
          <P>API Port, Environment, Container Port Range live in <Inline>backend/.env</Inline>. Change there and use the <strong className="text-white">Restart Server</strong> button (top-right of Settings) to apply — PM2 auto-respawns and the UI polls <Inline>/api/v1/health</Inline> until the API is back.</P>

          <H3>Diagnostics</H3>
          <P>One-click tests included on the Platform Domain card:</P>
          <ul className="list-disc list-inside text-slate-400 space-y-1.5 mb-4">
            <li><strong className="text-slate-300">Test DNS</strong> — verifies apex + wildcard A records resolve to this server</li>
            <li><strong className="text-slate-300">Check SSL</strong> — reads /etc/letsencrypt/live, shows issuer, expiry, days remaining, SANs</li>
            <li><strong className="text-slate-300">Test Ports</strong> — counts used/free ports in the container range, plus live kernel bind test</li>
          </ul>

          {/* Troubleshooting */}
          <H2 id="troubleshooting">Troubleshooting</H2>

          <H3>Permission denied on a script</H3>
          <Code>{`chmod +x install.sh update.sh uninstall.sh
# or
sudo bash update.sh   # bash doesn't need the execute bit`}</Code>

          <H3>git pull conflict on install.sh</H3>
          <P>Once-only issue on older clones made before <Inline>.gitattributes</Inline> was added (line-ending CRLF vs LF):</P>
          <Code>{`git checkout install.sh
git pull`}</Code>

          <H3>404 / wrong site on a base domain</H3>
          <P>Check <Inline>/etc/nginx/sites-enabled/</Inline> for stray configs left by a previous host. CloudDabba's main <Inline>nginx.conf</Inline> only loads <Inline>cd-*.conf</Inline> by convention — anything else is leftover. Remove it, then <Inline>sudo nginx -s reload</Inline>.</P>

          <H3>SSL install fails</H3>
          <P>Most common cause is port 80 not reachable from Let's Encrypt:</P>
          <Code>{`sudo tail -50 /var/log/letsencrypt/letsencrypt.log
curl -v http://yourdomain.com    # from your laptop, not the VPS`}</Code>
          <P>If curl times out, open port 80 in both UFW and the cloud provider firewall.</P>

          <H3>Deploy fails with EACCES on /tmp/clouddabba</H3>
          <P>Old root-owned tmp dir from a previous run as a different user. Clear it:</P>
          <Code>{`sudo rm -rf /tmp/clouddabba`}</Code>

          <H3>SPA deep links return 404 (e.g. /about loads but refresh 404s)</H3>
          <P>Fixed in current builds — CloudDabba bakes <Inline>try_files $uri $uri/ /index.html;</Inline> into the SPA nginx template. Redeploy after updating.</P>

          <H3>Deploy fails, or Smart Detection picks the wrong project type</H3>
          <P>
            Auto-detection is a best guess from repo structure — it can get it wrong for uncommon layouts, monorepos, or unrecognized frameworks. The reliable fix for any project type: commit a <Inline>Dockerfile</Inline> to the repo root and select <strong className="text-slate-300">Custom Dockerfile</strong> in the deploy wizard (see{' '}
            <a href="#custom-dockerfile-escape-hatch" className="text-blue-400 hover:underline">Custom Dockerfile</a> above). The live build log also prints this tip automatically whenever a deployment fails.
          </P>

          <H3>More help</H3>
          <P>
            Open an issue at{' '}
            <a href="https://github.com/niteshpawar97/CloudDabba/issues" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              github.com/niteshpawar97/CloudDabba/issues
            </a>.
          </P>

          <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between text-sm">
            <Link to="/" className="text-slate-400 hover:text-white">&larr; Back to home</Link>
            <a href="https://github.com/niteshpawar97/CloudDabba" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4" /> Star on GitHub
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
