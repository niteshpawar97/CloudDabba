# CloudDabba - Self-hosted PaaS Platform

A self-hosted deployment platform similar to Vercel/Render. Deploy GitHub repositories as Docker containers with auto-generated subdomains.

---

## Quick Setup (Development)

### Prerequisites

- **Node.js** v18+ → [https://nodejs.org](https://nodejs.org)
- **Docker Desktop** → [https://docker.com/products/docker-desktop](https://docker.com/products/docker-desktop)
- **Git** installed and available in PATH

### Step 1: Start PostgreSQL Database

```bash
cd CloudDabba
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- User: `clouddabba`
- Password: `password`
- Database: `clouddabba`

Verify it's running:
```bash
docker ps
```

### Step 2: Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migration (creates all tables)
npx prisma migrate dev --name init
npx prisma db push

# Seed database (creates demo user + sample project)
npx prisma db seed

# (Optional) View database in browser
npx prisma studio
```

### Step 3: Start Backend Server

```bash
cd backend
npm run dev
```

Backend runs on **http://localhost:4000**

Test it:
```
GET http://localhost:4000/api/v1/health
```

You should see:
```json
{
  "success": true,
  "message": "CloudDabba API is running",
  "timestamp": "2026-03-29T..."
}
```

### Step 4: Setup & Start Frontend

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## Testing the Full Flow

  Demo login:
  Email:    demo@clouddabba.com
  Password: demo1234


1. Open **http://localhost:5173** in browser
2. Click **Sign Up** → create an account
3. Go to **GitHub** page → add your GitHub Personal Access Token
   - Generate at: GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
   - Required scope: `repo` (full access)
4. Browse your repositories
5. Click **Deploy** on any repo
6. Watch real-time build logs

---

## Environment Configuration

Backend config is in `backend/.env`:

```env
# App
NODE_ENV=development
PORT=4000

# Database (matches docker-compose.yml)
DATABASE_URL=postgresql://clouddabba:password@localhost:5432/clouddabba

# JWT Secret (change in production!)
JWT_SECRET=dev-secret-change-in-production-abc123
JWT_EXPIRE=7d

# AES-256 Encryption Key for GitHub PAT (64 hex chars = 32 bytes)
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# Domain (use localhost for dev)
BASE_DOMAIN=localhost

# Docker socket path
DOCKER_SOCKET=/var/run/docker.sock

# NGINX (skipped in dev mode)
NGINX_SITES_PATH=../nginx/sites
NGINX_RELOAD_CMD=echo nginx-reload-skipped

# Container port range
PORT_RANGE_START=10000
PORT_RANGE_END=20000

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Register new user |
| POST | `/api/v1/auth/login` | Login → returns JWT |
| GET | `/api/v1/auth/me` | Get current user |
| PUT | `/api/v1/auth/github-pat` | Store GitHub PAT |
| GET | `/api/v1/github/repos` | List GitHub repos |
| GET | `/api/v1/github/repos/:owner/:repo/branches` | List branches |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/projects/:id` | Project detail |
| POST | `/api/v1/projects/:id/deploy` | Trigger deploy |
| GET | `/api/v1/deployments/:id` | Deployment detail |
| GET | `/api/v1/deployments/:id/logs` | Get logs |
| WS | `/ws?token=JWT&deploymentId=ID` | Real-time logs |

---

## Common Issues

### "Cannot connect to database"
- Make sure Docker is running: `docker ps`
- Check if PostgreSQL container is up: `docker compose up -d`
- Verify `DATABASE_URL` in `.env` matches `docker-compose.yml`

### "Docker socket not found"
- On Windows: Make sure Docker Desktop is running
- Docker socket path may differ:
  - Linux/Mac: `/var/run/docker.sock`
  - Windows (WSL): `//./pipe/docker_engine`

### "NGINX reload failed"
- Expected in dev mode — `NGINX_RELOAD_CMD` is set to `echo` which is harmless
- NGINX is only needed for production subdomain routing

### Prisma migration errors
```bash
# Reset database completely
npx prisma migrate reset
# Then re-run migration
npx prisma migrate dev --name init
```

---

## Project Structure

```
CloudDabba/
├── backend/               # Express + TypeScript API
│   ├── prisma/            # Database schema & migrations
│   ├── src/
│   │   ├── api/           # Controllers, routes, validators
│   │   ├── core/          # Services, middleware, types
│   │   ├── infrastructure/# Docker, NGINX, WebSocket
│   │   ├── database/      # Prisma connection
│   │   └── shared/        # Config, utils, logger
│   └── .env               # Environment config
├── frontend/              # React + Vite + Tailwind
│   ├── src/
│   │   ├── api/           # Axios API client
│   │   ├── components/    # UI components
│   │   ├── context/       # Auth context
│   │   ├── hooks/         # Custom hooks
│   │   ├── layouts/       # App & auth layouts
│   │   ├── pages/         # All pages
│   │   └── types/         # TypeScript types
│   └── vite.config.ts
├── docker-compose.yml     # PostgreSQL for dev
├── nginx/                 # NGINX configs
└── README.md
```

---

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS, TypeScript
- **Infra:** Docker (dockerode), NGINX, WebSocket (ws)
- **Auth:** JWT + bcrypt, AES-256 PAT encryption







# 1. SSH into VPS
ssh ubuntu@129.159.16.65

# 2. Run setup script (installs Docker, Node, NGINX, PM2)
curl -sSL https://raw.githubusercontent.com/... | bash
# OR copy setup-vps.sh manually and run it

# 3. Copy project files from local (run on your Windows)
scp -r backend frontend nginx ecosystem.config.js ubuntu@129.159.16.65:/opt/clouddabba/

# 4. SSH back and setup
ssh ubuntu@129.159.16.65
cd /opt/clouddabba/backend
cp .env.production .env
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run build

# 5. Build frontend
cd /opt/clouddabba/frontend
npm install
npm run build

# 6. Setup NGINX
sudo cp /opt/clouddabba/nginx/production.conf /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx

# 7. Start backend with PM2
cd /opt/clouddabba
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Done! Open http://cloud.niketgroup.com


-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDcwJtdYVe9v1GmR6rIUjXAunToWHJcCm0UBjv0yhsmKAAAAKgRiGSpEYhk
qQAAAAtzc2gtZWQyNTUxOQAAACDcwJtdYVe9v1GmR6rIUjXAunToWHJcCm0UBjv0yhsmKA
AAAEA1uzDfG21hor5edvY3SDlAf/A+Fu7oQ9UHEe48YRp/qdzAm11hV72/UaZHqshSNcC6
dOhYclwKbRQGO/TKGyYoAAAAI2xlYXJuLW5vZGVqc0BpbnN0YW5jZS0yMDI0MDkwOC0wNz
U0AQI=
-----END OPENSSH PRIVATE KEY-----
