# Management Scripts

Three scripts cover the full lifecycle. All run as `sudo` on Ubuntu/Debian and share the same progress-bar UX.

## First-time setup

After cloning or pulling the repo, make the scripts executable:

```bash
chmod +x install.sh update.sh uninstall.sh
```

`.gitattributes` pins line endings to LF so scripts work on Linux even when committed from Windows, but the Linux execute bit still has to be set locally. Skipping this gives `Permission denied`.

## install.sh — fresh install

```bash
sudo ./install.sh
```

13 steps, ~5–10 minutes:

1. Detect OS
2. Install dependencies (Node.js 22, Docker, NGINX, PM2, certbot, MariaDB)
3. Detect server public IP
4. Prompt for domain + admin email
5. Generate JWT / encryption / DB / Redis secrets
6. Write `backend/.env`
7. Start PostgreSQL + Redis containers
8. Configure MariaDB
9. Build backend (TypeScript + Prisma)
10. Build frontend (Vite)
11. Configure NGINX + UFW
12. Issue SSL via certbot (skipped for IP installs)
13. Start PM2 + health check

## update.sh — update to latest

```bash
sudo ./update.sh                  # default — master branch, full rebuild
sudo ./update.sh --yes            # non-interactive
sudo ./update.sh --branch develop # different branch
sudo ./update.sh --skip-frontend  # backend-only
sudo ./update.sh --skip-backend   # frontend-only
sudo ./update.sh --skip-prisma    # no schema changes
sudo ./update.sh --dir /opt/dabba # explicit path
```

PM2 restart happens only at the very end — failure in any earlier step leaves the previous build running.

## uninstall.sh — clean teardown

```bash
sudo ./uninstall.sh               # interactive, removes everything
sudo ./uninstall.sh --yes
sudo ./uninstall.sh --keep-ssl    # preserve Let's Encrypt certs for reinstall
sudo ./uninstall.sh --keep-mariadb
sudo ./uninstall.sh --keep-docker
```

What it removes:

- PM2 process (`clouddabba-api`)
- Docker containers (`clouddabba-db`, `clouddabba-redis`, app containers)
- Docker volumes (`postgres_data`, `redis_data`) + `clouddabba` network
- `clouddabba/*` Docker images
- NGINX configs in `/etc/nginx/sites-enabled/`
- Let's Encrypt certs (with separate confirm)
- MariaDB server + `/var/lib/mysql` + `/etc/mysql`
- UFW rules allowing Docker bridge → DB ports
- Install directory (sanity-checked so it doesn't nuke arbitrary paths)

Docker daemon, Node.js, nginx, and ufw packages are left installed (shared infrastructure).

## Typical workflows

```bash
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
