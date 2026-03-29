# Project: CloudDabba (Self-hosted PaaS Platform)

Architecture: Modular Monolith
Target: VPS (Ubuntu 22.04), Docker-based deployment system

## 🎯 Objective

Build a self-hosted deployment platform similar to Vercel/Render that:

* Deploys GitHub repositories (public/private)
* Supports Docker-based apps (Node.js + React.js primarily)
* Exposes app on a single port (e.g., 4000)
* Auto-generates subdomains per project
* Uses shared PostgreSQL database
* Allows multi-user login system with GitHub PAT (Personal Access Token)

---

## 🧠 Core Features

### 1. User System

* Signup/Login (JWT आधारित auth)
* User adds GitHub PAT
* Secure encryption of tokens (AES-256)

### 2. GitHub Integration

* Fetch user repositories using GitHub API
* Support:

  * Public repos
  * Private repos (via PAT)
* Repo selection UI

### 3. Deployment Engine (Core System)

* Clone repo using PAT
* Detect project type:

  * Node backend
  * React frontend
  * Fullstack (monorepo)
* Build Docker image dynamically

### 4. Docker Deployment

* Each app runs in isolated container
* Use dynamic port allocation OR reverse proxy
* Single exposed port via NGINX (preferred)

### 5. Reverse Proxy System

* NGINX config auto-generate
* Example:

  * project1.clouddabba.com → container1:3000
  * project2.clouddabba.com → container2:3000

### 6. Domain + Subdomain Auto Setup

* Use wildcard DNS:
  *.clouddabba.com → VPS IP
* Backend generates subdomain:
  {projectName}.{domain}

### 7. Shared PostgreSQL

* One DB server for all users
* Multi-tenant schema:

  * users
  * projects
  * deployments
  * logs

### 8. Deployment Logs

* Real-time logs (WebSocket)
* Build logs + runtime logs

### 9. CI/CD Flow

* Manual deploy button
* Auto deploy (GitHub webhook optional)

---

## 🏗️ System Architecture

### Backend

* Node.js (Express.js)
* PostgreSQL (Prisma ORM)
* WebSocket for logs

### Frontend

* React.js (Admin Panel)
* Tailwind CSS

### DevOps Layer

* Docker Engine
* Docker Compose
* NGINX Reverse Proxy
* GitHub API integration

---

## 📦 Deployment Flow

1. User logs in
2. Adds GitHub PAT
3. Selects repo
4. Clicks Deploy
5. System:

   * Clones repo
   * Detects config
   * Builds Docker image
   * Runs container
   * Generates subdomain
   * Updates NGINX
6. App becomes live

---

## ⚙️ Docker Strategy

### Option A (Recommended - Easy Users)

Auto-generate Dockerfile if not present:

Example:

* Node backend:
  FROM node:18
  WORKDIR /app
  COPY . .
  RUN npm install
  CMD ["npm","start"]

* React:
  Build → serve using nginx

---

### Option B (Advanced Users)

* Allow custom Dockerfile
* If exists → use directly

---

## 📁 Repo Structure Guidelines (Important)

### Recommended Structure (Fullstack)

* /backend
* /frontend

OR

### Single App

* server.js / app.js
* package.json

---

## 🔐 Security

* Store PAT encrypted
* Container isolation
* Resource limits (CPU, RAM)

---

## 🌐 VPS Setup Steps

1. Ubuntu install
2. Install Docker + Docker Compose
3. Install NGINX
4. Setup domain + wildcard DNS
5. Setup SSL (Let's Encrypt wildcard)

---

## 📊 Scaling Plan

* Start: Single VPS (2–4GB RAM)
* Later:

  * Multi-node Docker Swarm / Kubernetes

---

## 👨‍💻 Team Responsibilities

### Team 1 (Backend)

* Auth system
* GitHub integration
* Deployment engine
* Docker orchestration

### Team 2 (Frontend + DevOps)

* UI/UX dashboard
* NGINX automation
* Domain + SSL setup
* Logs UI

---

## 💡 Key Differentiator (IMPORTANT)

Make system usable for beginners:

* No Docker knowledge required
* Auto-detection system
* One-click deploy

---

## 🚀 Future Features

* GitHub webhook auto deploy
* Custom domains
* Billing system
* Monitoring dashboard

---

## 🧪 Testing

* Test with:

  * Simple Node app
  * React app
  * Fullstack repo

---

## 📌 Final Deliverables

* Working SaaS panel
* Deployment system
* Subdomain routing
* Docker automation
* Logs system

---

END OF DOCUMENT
