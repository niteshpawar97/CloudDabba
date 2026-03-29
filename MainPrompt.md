# CloudDabba Implementation Plan

## Context

CloudDabba is a self-hosted PaaS platform (like Vercel/Render) that deploys GitHub repos as Docker containers with auto-generated subdomains. This is a greenfield build — no code exists yet. The goal is to scaffold the full monorepo (backend + frontend) with all core modules.

**Tech Stack:** Node.js/Express (TypeScript), Prisma + PostgreSQL, React + Vite + Tailwind, Docker (dockerode), NGINX reverse proxy, WebSocket (ws) for logs, JWT auth, AES-256 PAT encryption.

---

## Project Structure

```
CloudDabba/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── server.ts                     # Entry point
│   │   ├── app.ts                        # Express setup + WS attach
│   │   ├── api/
│   │   │   ├── controllers/              # auth, github, project, deployment, log
│   │   │   ├── routes/                   # Route definitions + index aggregator
│   │   │   └── validators/               # express-validator chains
│   │   ├── core/
│   │   │   ├── middleware/               # auth, error-handler, validation, rate-limit
│   │   │   ├── services/                 # auth, github, project, deployment, docker, nginx, encryption, log
│   │   │   ├── types/
│   │   │   └── enums/
│   │   ├── infrastructure/
│   │   │   ├── docker/
│   │   │   │   ├── templates/            # node.Dockerfile, react.Dockerfile
│   │   │   │   └── docker-client.ts      # dockerode singleton
│   │   │   ├── nginx/
│   │   │   │   ├── nginx-manager.ts
│   │   │   │   └── templates/subdomain.conf.ejs
│   │   │   └── websocket/
│   │   │       └── log-stream.ts         # WS server for real-time logs
│   │   ├── database/
│   │   │   └── connection.ts             # Prisma singleton
│   │   └── shared/
│   │       ├── config/app.config.ts      # Typed env config
│   │       └── utils/                    # api-response, logger, port-allocator
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── nodemon.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                       # Routes + providers
│   │   ├── api/                          # client.ts (axios), auth, github, projects, deployments
│   │   ├── context/AuthContext.tsx
│   │   ├── hooks/                        # useAuth, useDeploymentLogs
│   │   ├── layouts/                      # AuthLayout, AppLayout (sidebar+navbar)
│   │   ├── pages/                        # Login, Signup, Dashboard, GitHubIntegration, ProjectDetail, Deploy, LogsViewer
│   │   ├── components/
│   │   │   ├── ui/                       # Button, Input, Badge, Card, Spinner, Modal
│   │   │   ├── Sidebar.tsx, Navbar.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── DeploymentStatusBadge.tsx
│   │   │   ├── RepoSelector.tsx
│   │   │   ├── LogTerminal.tsx           # Real-time log console
│   │   │   └── ProtectedRoute.tsx
│   │   ├── types/                        # auth, project, deployment, github, log
│   │   └── styles/index.css              # Tailwind directives
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── docker-compose.yml                    # Dev: PostgreSQL + platform
├── nginx/
│   ├── nginx.conf
│   └── sites/                            # Auto-generated per-project configs
└── MASTER PROMPT.md
```

---

## Phase 1: Backend Foundation

### 1.1 Project init
- `npm init` in `/backend`, install all deps
- Configure TypeScript (`tsconfig.json`), nodemon, scripts
- **Dependencies:** express, cors, helmet, compression, morgan, dotenv, @prisma/client, jsonwebtoken, bcryptjs, express-validator, express-rate-limit, dockerode, ws, winston, uuid, ejs
- **Dev deps:** typescript, ts-node, nodemon, prisma, all @types/*

### 1.2 Prisma schema
- Models: `User`, `Project`, `Deployment`, `Log`
- Enums: `ProjectType`, `ProjectStatus`, `DeploymentStatus`, `LogType`
- UUID PKs, cascade deletes, unique constraints (user email, subdomain, userId+projectName)

### 1.3 Core infrastructure
- `app.config.ts` — typed env config (port, db, jwt, encryption, docker, nginx, domain)
- `connection.ts` — Prisma singleton
- `api-response.ts` — standardized `{ success, data, message }` format
- `logger.ts` — Winston logger
- `app.ts` — Express app with middleware chain (helmet, cors, compression, morgan, json parser)
- `server.ts` — HTTP server boot + graceful shutdown
- Error handler middleware with custom `AppError` class
- Health check route `GET /api/v1/health`

### 1.4 Auth module
- `EncryptionService` — AES-256-CBC using Node crypto (for PAT storage)
- `AuthService` — signup (bcrypt hash), login (verify + JWT), getProfile
- Auth middleware — JWT verification, attaches `req.user`
- Routes: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/github-pat`
- Validators for all auth inputs

### 1.5 GitHub module
- `GitHubService` — `listRepos(pat)`, `listBranches(pat, owner, repo)` via fetch, `cloneRepo(pat, url, branch, dest)` via `execFile`, `detectProjectType(repoPath)`
- Routes: `GET /github/repos`, `GET /github/repos/:owner/:repo/branches`

---

## Phase 2: Deployment Engine

### 2.1 Docker service
- `docker-client.ts` — dockerode singleton (`/var/run/docker.sock`)
- `DockerService` — `buildImage()` (tar context, stream build logs), `createAndStartContainer()` (port binding, resource limits: 512MB RAM, 0.5 CPU), `stopContainer()`, `removeImage()`
- Dockerfile templates: `node.Dockerfile` (node:18-alpine, npm ci, npm start), `react.Dockerfile` (multi-stage: build + nginx:alpine)

### 2.2 NGINX service
- `NginxService` — `generateConfig(subdomain, port)` via EJS template, `removeConfig(subdomain)`, `reload()` (nginx -t && nginx -s reload)
- Template: server block listening on port 80, proxy_pass to container port

### 2.3 Port allocator
- Range 10000-20000, queries DB for used ports, returns next available

### 2.4 Deployment orchestrator
- `DeploymentService.deploy()` pipeline:
  1. Create Deployment record (QUEUED)
  2. Decrypt PAT → clone repo (CLONING)
  3. Detect project type → generate Dockerfile if missing (BUILDING)
  4. Build Docker image (stream logs via WS)
  5. Allocate port → run container (DEPLOYING)
  6. Generate NGINX config → reload (LIVE)
  7. Cleanup build dir
  8. On failure: FAILED status, log error, cleanup partial resources
- Runs async — API returns deployment ID immediately

### 2.5 WebSocket log streaming
- `ws` server attached to same HTTP server, path `/ws/logs/:deploymentId`
- Auth via `?token=` query param
- Map: `deploymentId → Set<WebSocket>`, broadcast log lines during build/deploy
- Message format: `{ type: "BUILD"|"RUNTIME"|"SYSTEM"|"STATUS", message, timestamp }`

### 2.6 Remaining routes
- Projects: CRUD (`POST/GET/GET/:id/PUT/DELETE /projects`), env vars (`PUT /projects/:id/env`)
- Deployments: `POST /projects/:id/deploy`, `GET /projects/:id/deployments`, `GET /deployments/:id`, `POST /deployments/:id/stop`
- Logs: `GET /deployments/:id/logs` (paginated historical)

---

## Phase 3: Frontend

### 3.1 Scaffold
- Vite + React + TypeScript template
- Install: react-router-dom, axios, clsx, lucide-react
- Tailwind CSS setup (v3 with config file for stability)
- Dark theme design (suits DevOps tool)

### 3.2 Auth layer
- `api/client.ts` — Axios instance, JWT interceptor, 401 handler
- `AuthContext.tsx` — token in localStorage, user state, login/logout/signup
- `ProtectedRoute.tsx` — redirect to /login if no token
- Pages: `Login.tsx`, `Signup.tsx` with `AuthLayout` (centered card)

### 3.3 App shell
- `AppLayout.tsx` — dark sidebar + top navbar + Outlet
- `Sidebar.tsx` — logo, nav links (Dashboard, GitHub, Deploy), logout
- `Navbar.tsx` — page title, user info
- UI primitives: Button, Input, Badge, Card, Spinner, Modal

### 3.4 Dashboard
- `Dashboard.tsx` — stats row + project grid
- `ProjectCard.tsx` — name, subdomain link, status badge, last deployed
- `DeploymentStatusBadge.tsx` — color-coded status chip

### 3.5 GitHub Integration
- `GitHubIntegration.tsx` — PAT form + repo list
- `RepoSelector.tsx` — searchable repo list with deploy buttons

### 3.6 Deploy flow
- `Deploy.tsx` — multi-step: select repo → branch → configure (name, type, env vars) → deploy
- Triggers API, redirects to logs viewer

### 3.7 Real-time logs
- `useDeploymentLogs.ts` — native WebSocket hook (connects to `ws://host/ws/logs/:id?token=`), batches lines at ~10fps
- `LogTerminal.tsx` — black bg, monospace, auto-scroll, color-coded levels, follow toggle
- `LogsViewer.tsx` — full-page log terminal
- Also embedded in `ProjectDetail.tsx` for latest deployment

### 3.8 Project detail
- `ProjectDetail.tsx` — project header, deployment history table, embedded log terminal

---

## Phase 4: DevOps Config

- `docker-compose.yml` — PostgreSQL service for dev environment
- `nginx/nginx.conf` — base config with wildcard server
- `.env.example` files for both backend and frontend
- `.gitignore` files

---

## API Routes Summary

All prefixed with `/api/v1`:

| Method | Route | Description |
|--------|-------|-------------|
| POST | /auth/signup | Register |
| POST | /auth/login | Login → JWT |
| GET | /auth/me | Current user |
| PUT | /auth/github-pat | Store encrypted PAT |
| GET | /github/repos | List user repos |
| GET | /github/repos/:owner/:repo/branches | List branches |
| POST | /projects | Create project |
| GET | /projects | List user projects |
| GET | /projects/:id | Project detail |
| PUT | /projects/:id | Update project |
| DELETE | /projects/:id | Delete + cleanup |
| PUT | /projects/:id/env | Set env vars |
| POST | /projects/:id/deploy | Trigger deploy |
| GET | /projects/:id/deployments | Deployment history |
| GET | /deployments/:id | Deployment detail |
| POST | /deployments/:id/stop | Stop deployment |
| GET | /deployments/:id/logs | Historical logs |
| WS | /ws/logs/:deploymentId | Real-time log stream |
| GET | /health | Health check |

---

## Verification

1. **Backend smoke test:** Start server, hit `/api/v1/health`, verify DB connection
2. **Auth flow:** Signup → login → get profile → store PAT
3. **GitHub integration:** Add PAT → list repos → list branches
4. **Deploy pipeline:** Select repo → trigger deploy → watch logs via WS → verify container runs → verify subdomain routes via NGINX
5. **Frontend E2E:** Login → dashboard → add PAT → browse repos → deploy → watch logs → see project live

---

## Build Order

1. Backend foundation (init, prisma, config, middleware, health check)
2. Auth + encryption modules
3. GitHub integration module
4. Docker + NGINX + deployment engine
5. WebSocket log streaming
6. Frontend scaffold + auth
7. Frontend app shell + dashboard
8. Frontend deploy flow + logs
9. Docker-compose + NGINX config for dev
