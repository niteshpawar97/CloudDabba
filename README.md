# CloudDabba - Self-hosted PaaS Platform

Deploy GitHub repositories as Docker containers with auto-generated subdomains, custom domains, and auto-SSL. Like Vercel/Render, but on your own server.

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/niteshpawar97/CloudDabba/master/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

The script installs all dependencies, generates secrets, configures NGINX + SSL, and starts the platform. Open the URL shown at the end to complete the first-time setup via the browser wizard.

> Prefer git clone? `git clone https://github.com/niteshpawar97/CloudDabba.git && cd CloudDabba && chmod +x install.sh && sudo ./install.sh`

---

## Management Scripts

All three scripts share the same visual style — progress bar, step counter, dimmed live output, elapsed time. They run only on Ubuntu/Debian-style VPS and need root (`sudo`).

> **First time after `git clone` or `git pull`:** make the scripts executable once.
> ```bash
> chmod +x install.sh update.sh uninstall.sh
> ```
> If you skip this, you'll see `bash: ./<script>.sh: Permission denied`. The `.gitattributes` pins line endings to LF so scripts work on Linux even when committed from Windows, but the Linux execute bit still has to be set locally.

### `install.sh` — Fresh install

Use on a brand new VPS. 13 steps, ~5–10 minutes end-to-end.

```bash
sudo ./install.sh
```

**What it does:**

| Step | Action |
|------|--------|
| 1 | Detect OS (Ubuntu/Debian) |
| 2 | Install dependencies (Node.js 22, Docker, NGINX, PM2, certbot, MariaDB) |
| 3 | Detect server public IP |
| 4 | Prompt for domain + admin email (press Enter for IP-only install) |
| 5 | Generate JWT / encryption / DB / Redis secrets |
| 6 | Write `backend/.env` |
| 7 | Start PostgreSQL + Redis containers |
| 8 | Configure MariaDB — creates `clouddabba_admin` user + writes credentials to `.env` |
| 9 | Build backend (TypeScript + Prisma) |
| 10 | Build frontend (Vite) |
| 11 | Configure NGINX + UFW (opens 80, 443, 6050, 10000–20000) |
| 12 | Issue SSL certificate via certbot (skipped for IP installs) |
| 13 | Start PM2 + health check |

Ends with a credentials summary listing the domain, admin email, panel URL, and a reminder to open cloud-provider firewall for the same ports.

### `update.sh` — Update to latest

For operators who don't run their own CI/CD. Safe to re-run (idempotent).

```bash
sudo ./update.sh                     # default — master branch, full rebuild
sudo ./update.sh --yes               # non-interactive
sudo ./update.sh --branch develop    # test a different branch
sudo ./update.sh --skip-frontend     # backend-only update
sudo ./update.sh --skip-backend      # frontend-only update
sudo ./update.sh --skip-prisma       # schema unchanged, skip db push
sudo ./update.sh --dir /opt/dabba    # explicit install path
```

**What it does:**

| Step | Action |
|------|--------|
| 1 | Pre-flight — detect install dir from PM2 cwd, verify git/node/npm/pm2 |
| 2 | Stash any local changes, `git fetch + checkout + reset --hard origin/<branch>`, print new commits |
| 3 | Backend `npm ci` (prefer-offline) |
| 4 | `prisma generate` + `prisma db push` |
| 5 | Backend `npm run build` + `dist/` check |
| 6 | Frontend `npm ci` + build + `dist/index.html` check |
| 7 | `pm2 restart clouddabba-api --update-env` (fresh start if the process was gone) |
| 8 | Health check on `/api/v1/health` with retries |

The PM2 restart only happens at the very end, so a failure in any earlier step leaves the previous process running — you never lose the old build.

### `uninstall.sh` — Full cleanup

For fresh reinstalls or decommissioning. Destructive — prompts before each stage by default.

```bash
sudo ./uninstall.sh                  # interactive, removes everything
sudo ./uninstall.sh --yes            # non-interactive
sudo ./uninstall.sh --keep-ssl       # preserve Let's Encrypt certs (reuse on reinstall)
sudo ./uninstall.sh --keep-mariadb   # leave MariaDB package + data
sudo ./uninstall.sh --keep-docker    # leave Docker + images alone
sudo ./uninstall.sh --dir /opt/dabba # explicit install path
```

**What it removes:**

- PM2 process (`clouddabba-api`)
- Docker containers (`clouddabba-db`, `clouddabba-redis`, all `clouddabba-app-*`)
- Docker volumes (`postgres_data`, `redis_data`) + `clouddabba` network + `clouddabba/*` images
- NGINX configs in `/etc/nginx/sites-enabled/*` (main + per-app)
- Let's Encrypt certs (separate confirm)
- MariaDB server + `/var/lib/mysql` + `/etc/mysql`
- UFW rules allowing Docker bridge → DB ports
- Install directory (sanity-checked — refuses to delete arbitrary paths)

Docker daemon, Node.js, nginx, and ufw packages are left installed (shared infra).

### Typical workflows

```bash
# One-time after git clone or git pull
chmod +x install.sh update.sh uninstall.sh

# Fresh VPS → production
sudo ./install.sh

# Existing install → update to latest
sudo ./update.sh

# Test a feature branch
sudo ./update.sh --branch feature/xyz

# Nuke and reinstall (same domain → keep SSL)
sudo ./uninstall.sh --keep-ssl
sudo ./install.sh

# Fully decommission
sudo ./uninstall.sh --yes
```

### Troubleshooting the scripts

| Error | Fix |
|-------|-----|
| `./update.sh: Permission denied` | `chmod +x *.sh` |
| `sudo: ./update.sh: command not found` | Same — missing execute bit. Run `chmod +x *.sh` or use `sudo bash update.sh` (bash doesn't need the execute bit). |
| `error: Your local changes to install.sh would be overwritten` | `git checkout install.sh` then `git pull` again. Happens when pulling an older clone made before `.gitattributes` was added — once-only. |
| `update.sh` says "Not a git repo" | Installed via `curl` one-liner. Clone the repo instead: `git clone ... && cd CloudDabba && sudo ./update.sh`. |

---

## Docker Deployment

If you prefer containers over the VPS-style install, use `docker-compose.prod.yml`. No wrapper scripts needed — Docker Compose itself is the "script".

### Install

```bash
git clone https://github.com/niteshpawar97/CloudDabba.git
cd CloudDabba
cp .env.docker .env

# Generate secrets
sed -i "s/CHANGE_ME_JWT_SECRET/$(openssl rand -base64 48)/g" .env
sed -i "s/CHANGE_ME_DB_PASSWORD/$(openssl rand -base64 24 | tr -d '/+=')/g" .env
sed -i "s/CHANGE_ME_REDIS_PASSWORD/$(openssl rand -base64 24 | tr -d '/+=')/g" .env
sed -i "s/CHANGE_ME_64_CHAR_HEX_STRING/$(openssl rand -hex 32)/g" .env

docker compose -f docker-compose.prod.yml up -d
```

Open `http://YOUR_IP:6050/setup` to finish first-time setup via the browser wizard.

### Update

```bash
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build
```

The `--build` rebuilds the app image from the latest source. `pull` refreshes the `postgres`/`redis` base images.

### Uninstall

```bash
docker compose -f docker-compose.prod.yml down -v     # -v also deletes DB + Redis volumes
docker rmi $(docker images --filter reference='clouddabba/*' -q) 2>/dev/null
```

### Common ops

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Restart | `docker compose -f docker-compose.prod.yml restart app` |
| Shell into app | `docker compose -f docker-compose.prod.yml exec app sh` |
| Prisma migrate | `docker compose -f docker-compose.prod.yml exec app npx prisma db push` |
| Stop everything | `docker compose -f docker-compose.prod.yml down` (keeps volumes) |

### ⚠️ Production readiness — honest comparison

`docker-compose.prod.yml` spins up **CloudDabba + PostgreSQL + Redis** and exposes the panel on port 6050. For most PaaS features you will need more. Here's what works out of the box and what doesn't:

| Feature | VPS install (`install.sh`) | Docker Compose (`docker-compose.prod.yml`) |
|---------|:--:|:--:|
| Admin panel, users, API, GitHub integration | ✅ | ✅ |
| Deploy user apps as containers (via docker.sock) | ✅ | ✅ |
| Per-project PostgreSQL | ✅ | ✅ |
| Per-project Redis | ✅ | ✅ |
| Per-project MariaDB | ✅ | ❌ (no MariaDB service in compose) |
| HTTPS / Let's Encrypt for the panel itself | ✅ | ❌ (port 6050 HTTP only) |
| `*.yourdomain.com` subdomains for deployed apps | ✅ | ❌ (no host NGINX access from container) |
| Automatic SSL for custom domains on deployed apps | ✅ | ❌ (needs Traefik/Caddy layer) |
| One-command updates with health check | ✅ (`update.sh`) | ✅ (`docker compose up -d --build`) |

**Bottom line:**

- **Use Docker Compose** if you're doing a single-instance deployment where all apps are accessed via `http://YOUR_IP:PORT` and you don't need auto-SSL or subdomain routing. Great for homelab, internal tools, evaluation, and dev/staging environments.
- **Use `install.sh`** if you want the full Vercel/Railway experience — custom domains with auto-SSL, wildcard subdomains, platform-managed NGINX, MariaDB provisioning. This is the recommended path for serving real users.

### Turning the Docker setup into full production

To close the gaps above:

1. **Add MariaDB service** — append a `mariadb` block to `docker-compose.prod.yml` and set `MARIADB_HOST=mariadb` in the app env.
2. **Add a reverse proxy** — run **Traefik** or **Caddy** in front of the `app` service to terminate TLS and route `*.yourdomain.com` to the app. This replaces the platform's NGINX auto-config.
3. **Expose Docker socket safely** — the compose file already mounts `/var/run/docker.sock`; keep that host-level and don't expose the app service externally without a proxy.
4. **Persistent certs** — mount a volume for the proxy's cert store so `docker compose up -d --build` doesn't trigger a fresh Let's Encrypt issuance every time.

A `docker-compose.full.yml` with Traefik + MariaDB bundled isn't included yet — if you need it, open an issue.

---

## Features

- **One-Click Install** - install.sh sets up everything automatically on Ubuntu/Debian
- **Setup Wizard** - Browser-based first-time configuration (domain, admin account)
- **Smart Detection** - Auto-detects React, Vue, Angular, Svelte, Next.js, Express, NestJS, Fastify, Nuxt, SvelteKit + more
- **Subdirectory Detection** - Finds apps inside subdirectories (e.g., /notes-app/package.json)
- **Any Repo Structure** - Monorepo, root-backend, separate dirs, single app - all handled automatically
- **TypeScript Native** - Auto-transpiles TypeScript before deployment
- **Docker Native** - Generates optimized Dockerfiles per project type
- **Database Provisioning** - Per-project PostgreSQL, MariaDB, and Redis with auto-injected credentials
- **Auto-SSL** - Let's Encrypt certificates issued automatically on custom domain verification
- **Custom Domains** - Add your own domain with DNS verification, subdomain auto-redirect
- **Real-time Logs** - Build + runtime container logs via WebSocket
- **Auto-Deploy** - GitHub webhook integration for deploy on push
- **Admin Panel** - Users, projects, containers, images, databases, changelog
- **Health Monitoring** - Detailed health check endpoint with per-service status

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL |
| Frontend | React, Vite, Tailwind CSS, TypeScript |
| Infrastructure | Docker (dockerode), NGINX, WebSocket (ws), Let's Encrypt |
| Databases | PostgreSQL, MariaDB, Redis (per-project provisioning) |
| Auth | JWT + bcrypt, AES-256 PAT encryption |
| Deploy | PM2, GitHub Actions CI/CD, Docker Compose |

---

## Local Development Setup

### Prerequisites

- Node.js v22+
- Docker Desktop
- Git

### 1. Start Database

```bash
docker compose up -d
```

### 2. Setup Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed    # Creates admin user
npm run dev            # Runs on http://localhost:4000
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev            # Runs on http://localhost:5173
```

### 4. Test

Open http://localhost:5173 and login:
```
Email:    admin@clouddabba.dev
Password: admin123
```

---

## VPS Production Setup (Ubuntu)

### Prerequisites

- Ubuntu VPS (Oracle Cloud, AWS, DigitalOcean, etc.)
- Domain pointing to VPS IP (A record)
- Ports open: 80, 443, 6050 (or your app port)

### 1. Install Dependencies

```bash
# SSH into VPS
ssh ubuntu@YOUR_IP

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install NGINX, PM2, Certbot
sudo apt install -y nginx
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx

# Install PostgreSQL (or use Docker)
docker run -d --name clouddabba-db \
  -e POSTGRES_USER=clouddabba \
  -e POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD \
  -e POSTGRES_DB=clouddabba \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:16-alpine
```

### 2. Create App User

```bash
sudo useradd -m -s /bin/bash learn-nodejs
# Give sudo access for certbot, nginx, docker
echo 'learn-nodejs ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/clouddabba
sudo chmod 440 /etc/sudoers.d/clouddabba
sudo usermod -aG docker learn-nodejs
```

### 3. Clone & Build

```bash
su - learn-nodejs
mkdir -p ~/htdocs && cd ~/htdocs
git clone https://github.com/YOUR_USER/CloudDabba.git clouddabba
cd clouddabba

# Backend
cd backend
cp .env.production .env
# Edit .env with your values (see Environment Config below)
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run build

# Frontend
cd ../frontend
npm install
npm run build
```

### 4. Configure Environment

Edit `backend/.env` (copy from `.env.production`):

```env
NODE_ENV=production
PORT=6050
DATABASE_URL=postgresql://clouddabba:YOUR_PASSWORD@localhost:5432/clouddabba

JWT_SECRET=GENERATE_A_LONG_RANDOM_STRING
JWT_EXPIRE=7d
ENCRYPTION_KEY=GENERATE_64_HEX_CHARS

BASE_DOMAIN=yourdomain.dev
DOCKER_SOCKET=/var/run/docker.sock

# NGINX - must point to sites-enabled for auto-config
NGINX_SITES_PATH=/etc/nginx/sites-enabled
NGINX_RELOAD_CMD=sudo nginx -s reload

PORT_RANGE_START=10000
PORT_RANGE_END=20000
CORS_ORIGIN=https://yourdomain.dev
SSL_EMAIL=your@email.com
```

### 5. Setup Wildcard SSL (Cloudflare DNS)

```bash
# Install Cloudflare plugin
sudo apt install -y python3-certbot-dns-cloudflare

# Create Cloudflare API token config
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini > /dev/null << EOF
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

# Issue wildcard certificate
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d yourdomain.dev \
  -d '*.yourdomain.dev' \
  --agree-tos --email your@email.com
```

### 6. Configure NGINX

```bash
sudo tee /etc/nginx/sites-enabled/clouddabba.conf > /dev/null << 'EOF'
# Main app (dashboard)
server {
    listen 443 ssl;
    server_name yourdomain.dev;

    ssl_certificate /etc/letsencrypt/live/yourdomain.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:6050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Wildcard subdomain (deployed apps)
server {
    listen 443 ssl;
    server_name *.yourdomain.dev;

    ssl_certificate /etc/letsencrypt/live/yourdomain.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:6050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.dev *.yourdomain.dev;
    return 301 https://$host$request_uri;
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

### 7. Start with PM2

```bash
cd ~/htdocs/clouddabba
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the output command with sudo
```

### 8. Setup CI/CD (GitHub Actions)

1. Generate SSH key:
```bash
ssh-keygen -t ed25519 -C "clouddabba-deploy" -f /tmp/deploy_key -N ""
cat /tmp/deploy_key.pub >> ~/.ssh/authorized_keys
cat /tmp/deploy_key  # Copy this (private key)
rm /tmp/deploy_key /tmp/deploy_key.pub
```

2. In GitHub repo: Settings → Secrets → Actions, add:
   - `SSH_PRIVATE_KEY` = private key content
   - `SSH_HOST` = your VPS IP
   - `SSH_USER` = learn-nodejs

3. Push to master → auto-deploys via `.github/workflows/deploy.yml`

---

## How Deployment Works

```
1. User adds repo (GitHub/Public URL/ZIP upload)
2. CloudDabba scans → detects project type + framework
3. Reorganizes repo into standard backend/ + frontend/ layout (if fullstack)
4. Generates optimized Dockerfile (or uses custom Dockerfile)
5. Builds Docker image (logs stream in real-time)
6. Allocates port (range 10000-20000)
7. Starts container with resource limits (512MB RAM, 0.5 CPU)
8. Generates NGINX config for subdomain routing
9. App is live at https://appname.yourdomain.dev
```

### Supported Project Types

| Type | Template | Handles |
|------|----------|---------|
| `NODE_BACKEND` | node.Dockerfile | Express, Fastify, NestJS, Koa, Hapi, Nuxt, SvelteKit |
| `REACT_FRONTEND` | react.Dockerfile | React, Vue, Angular, Svelte, Astro, Gatsby, Solid.js |
| `NEXTJS_APP` | nextjs.Dockerfile | Next.js (standalone mode) |
| `STATIC_SITE` | static.Dockerfile | HTML/CSS/JS static files |
| `FULLSTACK` | fullstack.Dockerfile | Any backend + frontend combo (nginx + node) |
| `CUSTOM_DOCKERFILE` | User's Dockerfile | Any custom setup |

### Repo Structures Auto-Handled

```
Standard:       Root Backend:       Monorepo:
├── backend/    ├── server.js       ├── packages/
├── frontend/   ├── package.json    │   ├── api/
                ├── client/         │   └── web/
                                    └── package.json
```

---

## Setup Wizard

On first run, CloudDabba shows a browser-based setup wizard at `/setup`:

1. **Welcome** - Platform introduction
2. **Domain & Email** - Configure base domain and admin email
3. **Admin Account** - Set admin name and password
4. **Complete** - Platform is ready, redirects to dashboard

The setup wizard blocks all other routes until completed. After setup, `/setup` redirects to the dashboard.

---

## Database Provisioning

Each project can enable managed databases from the Project Detail page:

| Database | Env Var Injected | Description |
|----------|-----------------|-------------|
| PostgreSQL | `DATABASE_URL` | Dedicated database + user per project |
| MariaDB | `MYSQL_URL` | Dedicated database + user per project |
| Redis | `REDIS_URL` | Dedicated database number (1-15) |

- Click **Enable** on any database in the Databases card
- Connection URL is auto-generated with random credentials
- URL is auto-injected into containers on every deploy
- **Test Connection** button verifies connectivity
- Databases are cleaned up when project is deleted
- Admin panel shows all provisioned databases at `/admin/databases`

---

## Custom Domains

### Setup Steps

1. Go to **Project Detail** → **Custom Domain** section
2. Enter your domain (e.g., `example.com` or `app.example.com`) → Click **Add Domain**
3. CloudDabba will show DNS records to configure:

| Domain Type | Record | Name | Value |
|-------------|--------|------|-------|
| Root domain (example.com) | **A** | `@` | Your server IP (auto-detected) |
| Subdomain (app.example.com) | **CNAME** | `app` | `appname.yourdomain.dev` |

4. Go to your **domain registrar** (GoDaddy, Namecheap, Cloudflare, etc.) and add the DNS record
5. Come back to CloudDabba → Click **Verify DNS**
6. On successful verification: NGINX config generated → SSL certificate issued (Let's Encrypt) → HTTPS live

### UI Features

- **Copy buttons** on all DNS values (IP, CNAME target) for quick copy-paste
- **DNS Instructions card** with exact record type, name, and value to add
- **Verify DNS button** to re-check anytime after adding records
- **Remove Domain** button to detach custom domain from project
- **Status indicator** — shows verified (green) or pending (yellow)

### Important Notes

- Custom domain setup takes **~3-5 minutes** to fully activate (DNS propagation + SSL issuance + NGINX reload). It does **not** work instantly.
- **Root domains** (example.com) require an **A record** — CNAME cannot be used on root domains (DNS standard).
- **Subdomains** (app.example.com) can use either **CNAME** or **A record**.
- SSL certificates are auto-issued via **Let's Encrypt certbot** — no manual SSL setup needed.
- Only **one custom domain** per project is supported currently.

---

## Auto-Deploy (GitHub Webhook)

1. Go to Project Detail → Auto-Deploy → Enable
2. Copy **Webhook URL** and **Secret**
3. In GitHub repo: Settings → Webhooks → Add webhook
   - Payload URL: paste webhook URL
   - Content type: `application/json`
   - Secret: paste secret
   - Events: Just the push event
4. Push to branch → CloudDabba auto-deploys

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Detailed health check (DB, Docker, setup) |
| GET | `/api/v1/config` | Platform config + setup status |
| GET | `/api/v1/setup/status` | First-time setup status |
| POST | `/api/v1/setup/complete` | Complete first-time setup |
| POST | `/api/v1/auth/signup` | Register |
| POST | `/api/v1/auth/login` | Login → JWT |
| GET | `/api/v1/auth/me` | Current user |
| PUT | `/api/v1/auth/github-pat` | Store GitHub PAT |
| GET | `/api/v1/github/repos` | List repos |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects/:id/deploy` | Trigger deploy |
| GET | `/api/v1/projects/:id/domain` | Domain status |
| POST | `/api/v1/projects/:id/domain` | Set custom domain |
| POST | `/api/v1/projects/:id/domain/verify` | Verify DNS |
| POST | `/api/v1/projects/:id/webhook` | Enable auto-deploy |
| GET | `/api/v1/projects/:id/database` | Database provisioning status |
| POST | `/api/v1/projects/:id/database/postgres` | Enable PostgreSQL |
| POST | `/api/v1/projects/:id/database/mariadb` | Enable MariaDB |
| POST | `/api/v1/projects/:id/database/redis` | Enable Redis |
| POST | `/api/v1/projects/:id/database/test` | Test database connections |
| GET | `/api/v1/deployments/:id` | Deployment detail |
| GET | `/api/v1/deployments/:id/logs` | Get logs |
| GET | `/api/v1/deployments/:id/stats` | Container CPU/memory |
| POST | `/api/webhook/github/:projectId` | GitHub webhook (public) |
| WS | `/ws?token=JWT&deploymentId=ID` | Real-time build logs |
| WS | `/ws?token=JWT&deploymentId=ID&mode=container` | Runtime logs |

---

## Admin Panel

Access at `/admin` (admin role required). Features:
- Dashboard with platform stats (users, projects, deployments, containers, databases)
- User management (role toggle, delete)
- All projects and deployments
- Docker container management (stop, remove, cleanup exited)
- Docker image management (delete, cleanup unused)
- Database management (view/delete provisioned PostgreSQL, MariaDB, Redis)
- Deployment logs viewer
- Platform settings
- Changelog (version history of platform updates)

---

## Project Structure

```
CloudDabba/
├── backend/
│   ├── prisma/                    # Database schema + seed
│   ├── src/
│   │   ├── api/                   # Controllers, routes, validators
│   │   ├── core/
│   │   │   ├── services/
│   │   │   │   ├── deployment.service.ts         # Deploy pipeline
│   │   │   │   ├── docker.service.ts             # Docker operations
│   │   │   │   ├── domain.service.ts             # Custom domain + DNS
│   │   │   │   ├── github.service.ts             # Detection engine
│   │   │   │   ├── nginx.service.ts              # NGINX + auto-SSL
│   │   │   │   ├── database-provision.service.ts # DB provisioning
│   │   │   │   ├── setup.service.ts              # First-time setup
│   │   │   │   └── log.service.ts                # Log streaming
│   │   │   └── middleware/
│   │   │       ├── subdomain-proxy.middleware.ts
│   │   │       └── setup-guard.middleware.ts      # Blocks until setup done
│   │   ├── infrastructure/
│   │   │   ├── docker/templates/  # Dockerfile templates
│   │   │   └── websocket/         # WebSocket log streaming
│   │   ├── data/changelog.ts      # Platform version history
│   │   └── shared/                # Config, utils
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── landing/           # Landing page sections
│   │   │   ├── admin/             # Admin panel (8 pages)
│   │   │   ├── SetupWizard.tsx    # First-time setup wizard
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Deploy.tsx         # Deploy wizard
│   │   │   ├── ProjectDetail.tsx  # Project + domain + webhook + databases
│   │   │   └── LogsViewer.tsx     # Build + runtime logs
│   │   └── components/ui/         # Button, Card, Input, Toast, Spinner
├── nginx/
│   ├── clouddabba.conf.template   # NGINX template for install.sh
│   └── production.conf
├── .github/workflows/deploy.yml   # CI/CD (auto-deploy on push)
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # Dev (PostgreSQL + Redis)
├── docker-compose.prod.yml        # Production (full platform)
├── docker-entrypoint.sh           # Docker startup script
├── install.sh                     # One-click installer (fresh VPS)
├── update.sh                      # Update to latest (git pull + rebuild + pm2 restart)
├── uninstall.sh                   # Full cleanup (containers, volumes, configs, certs)
├── ecosystem.config.js            # PM2 config
└── .env.docker                    # Docker env template
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+D` | Go to Deploy page |
| `Ctrl+H` | Go to Dashboard |

---

## Troubleshooting

### Database connection failed
```bash
docker ps                          # Check if DB container is running
docker compose up -d               # Start DB
```

### Docker socket not found
```bash
# Linux
ls -la /var/run/docker.sock
# Windows (Docker Desktop)
# Use: //./pipe/dockerDesktopLinuxEngine
```

### NGINX permission denied
```bash
# Give app user permission
sudo chown learn-nodejs:learn-nodejs /etc/nginx/sites-enabled
```

### Custom domain not working
```bash
# Check CloudDabba domain/SSL logs
pm2 logs clouddabba-api --lines 50 --nostream 2>&1 | grep -i "ssl\|cert\|custom\|nginx\|verified\|domain"

# Check if NGINX config was generated
sudo ls -la /etc/nginx/sites-enabled/ | grep yourdomain

# Check if SSL cert exists
sudo certbot certificates | grep -A5 yourdomain

# Test NGINX config is valid
sudo nginx -t
```
> Custom domain + auto-SSL takes **~3-5 minutes** after DNS verification. Don't panic if it doesn't work instantly.

### SSL certificate failed
```bash
# Check certbot logs
sudo cat /var/log/letsencrypt/letsencrypt.log | tail -50
# Manual test
sudo certbot certonly --dry-run -d yourdomain.com
# Check if port 443 is listening
sudo ss -tlnp | grep 443
# Check cert expiry
sudo openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates
```

### Container keeps restarting
```bash
docker logs CONTAINER_NAME         # Check error
docker ps -a --filter name=cd-     # List CloudDabba containers
```

### PM2 process not starting
```bash
pm2 logs clouddabba-api --lines 50
pm2 restart clouddabba-api --update-env
```

---

## License

MIT