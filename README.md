# CloudDabba - Self-hosted PaaS Platform

Deploy GitHub repositories as Docker containers with auto-generated subdomains, custom domains, and auto-SSL. Like Vercel/Render, but on your own server.

## Features

- **Smart Detection** - Auto-detects React, Vue, Angular, Svelte, Next.js, Express, NestJS, Fastify, Nuxt, SvelteKit + more
- **Any Repo Structure** - Monorepo, root-backend, separate dirs, single app - all handled automatically
- **TypeScript Native** - Auto-transpiles TypeScript before deployment
- **Docker Native** - Generates optimized Dockerfiles per project type
- **Auto-SSL** - Let's Encrypt certificates issued automatically on custom domain verification
- **Custom Domains** - Add your own domain with DNS verification and auto-SSL
- **Real-time Logs** - Build + runtime container logs via WebSocket
- **Auto-Deploy** - GitHub webhook integration for deploy on push
- **Admin Panel** - Platform management for the owner

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL |
| Frontend | React, Vite, Tailwind CSS, TypeScript |
| Infrastructure | Docker (dockerode), NGINX, WebSocket (ws), Let's Encrypt |
| Auth | JWT + bcrypt, AES-256 PAT encryption |
| CI/CD | GitHub Actions + SSH deploy |

---

## Local Development Setup

### Prerequisites

- Node.js v18+
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
| GET | `/api/v1/deployments/:id` | Deployment detail |
| GET | `/api/v1/deployments/:id/logs` | Get logs |
| GET | `/api/v1/deployments/:id/stats` | Container CPU/memory |
| POST | `/api/webhook/github/:projectId` | GitHub webhook (public) |
| WS | `/ws?token=JWT&deploymentId=ID` | Real-time build logs |
| WS | `/ws?token=JWT&deploymentId=ID&mode=container` | Runtime logs |

---

## Admin Panel

Access at `/admin` (admin role required). Features:
- Dashboard with platform stats
- User management (role toggle, delete)
- All projects and deployments
- Docker container management (stop, remove, cleanup exited)
- Docker image management (delete, cleanup unused)
- Deployment logs viewer

---

## Project Structure

```
CloudDabba/
├── backend/
│   ├── prisma/                    # Database schema
│   ├── src/
│   │   ├── api/                   # Controllers, routes, validators
│   │   ├── core/                  # Services, middleware
│   │   │   ├── services/
│   │   │   │   ├── deployment.service.ts   # Deploy pipeline
│   │   │   │   ├── docker.service.ts       # Docker operations
│   │   │   │   ├── domain.service.ts       # Custom domain + DNS
│   │   │   │   ├── github.service.ts       # Detection engine
│   │   │   │   ├── nginx.service.ts        # NGINX + auto-SSL
│   │   │   │   └── log.service.ts          # Log streaming
│   │   │   └── middleware/
│   │   │       └── subdomain-proxy.middleware.ts
│   │   ├── infrastructure/
│   │   │   ├── docker/templates/  # Dockerfile templates
│   │   │   └── websocket/         # WebSocket log streaming
│   │   └── shared/                # Config, utils
│   └── .env.production
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Button, Card, Input, Toast, Skeleton
│   │   │   ├── Icon3DPro.tsx      # 3D icon system
│   │   │   ├── LogTerminal.tsx    # Real-time log viewer
│   │   │   └── Breadcrumbs.tsx
│   │   ├── pages/
│   │   │   ├── landing/           # Landing page sections
│   │   │   ├── admin/             # Admin panel pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Deploy.tsx         # Deploy wizard
│   │   │   ├── ProjectDetail.tsx  # Project + domain + webhook
│   │   │   └── LogsViewer.tsx     # Build + runtime logs
│   │   └── hooks/
│   │       ├── useDeploymentLogs.ts
│   │       ├── useContainerLogs.ts
│   │       └── useKeyboardShortcuts.ts
├── .github/workflows/deploy.yml   # CI/CD
├── ecosystem.config.js            # PM2 config
└── docker-compose.yml             # Dev database
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
