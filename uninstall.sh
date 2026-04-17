#!/usr/bin/env bash
set -uo pipefail

# ============================================
# CloudDabba - Uninstall Script
# Removes PM2 process, Docker containers,
# volumes, NGINX configs, SSL certs, install dir,
# optional MariaDB + UFW rules
# ============================================

VERSION="1.0.0"
INSTALL_DIR_DEFAULT="$(cd "$(dirname "$0")" && pwd)"

# --- Colors ---
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
C='\033[0;36m'
D='\033[0;90m'
W='\033[1;37m'
BLD='\033[1m'
N='\033[0m'

# --- Flags ---
YES=0
KEEP_SSL=0
KEEP_MARIADB=0
KEEP_DOCKER=0
INSTALL_DIR=""

usage() {
  cat <<EOF
CloudDabba Uninstall — v${VERSION}

Usage: sudo ./uninstall.sh [options]

Options:
  --yes              Non-interactive, assume YES to all prompts
  --dir PATH         CloudDabba install directory (default: auto-detect)
  --keep-ssl         Don't delete Let's Encrypt certs
  --keep-mariadb     Don't remove mariadb-server package
  --keep-docker      Don't remove Docker or app containers
  -h, --help         Show this help

By default the script removes:
  • PM2 process       (clouddabba-api)
  • Docker containers (clouddabba-db, clouddabba-redis, app containers)
  • Docker volumes    (postgres_data, redis_data)
  • NGINX configs     (/etc/nginx/sites-enabled/*.conf related to CloudDabba)
  • Install directory (backend + frontend + .env)
  • UFW rules         (5432 / 6379 / 3306 allowances for Docker)
  • MariaDB           (package + data dir)
  • Let's Encrypt     (live/archive/renewal for every cert)

It does NOT touch Node.js, nginx, ufw, or Docker itself (unless empty).
EOF
}

# Banner
banner() {
  clear 2>/dev/null || true
  echo ""
  echo -e "  ${R}${BLD}╔═══════════════════════════════════════════════╗${N}"
  echo -e "  ${R}${BLD}║       CloudDabba  •  Uninstall v${VERSION}           ║${N}"
  echo -e "  ${R}${BLD}╚═══════════════════════════════════════════════╝${N}"
  echo ""
}

say()  { echo -e "  ${D}│${N} $1"; }
ok()   { echo -e "  ${D}│${N} ${G}✓${N} $1"; }
wrn()  { echo -e "  ${D}│${N} ${Y}⚠${N} $1"; }
err()  { echo -e "  ${D}│${N} ${R}✗${N} $1"; }

section() {
  echo ""
  echo -e "  ${C}${BLD}━━ $1 ━━${N}"
}

confirm() {
  local prompt="$1"
  if [ "$YES" -eq 1 ]; then return 0; fi
  read -rp "$(echo -e "  ${Y}?${N} $prompt [y/N]: ")" ans
  [[ "${ans:-}" =~ ^[Yy]$ ]]
}

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --dir) INSTALL_DIR="$2"; shift ;;
    --keep-ssl) KEEP_SSL=1 ;;
    --keep-mariadb) KEEP_MARIADB=1 ;;
    --keep-docker) KEEP_DOCKER=1 ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

# Must be root
if [ "$(id -u)" -ne 0 ]; then
  err "Please run as root:  sudo $0 $*"
  exit 1
fi

banner

# Detect install dir
if [ -z "$INSTALL_DIR" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    INSTALL_DIR=$(pm2 show clouddabba-api 2>/dev/null | grep -E "^\s*cwd\s+" | awk '{print $NF}' | head -n 1 || true)
  fi
  INSTALL_DIR="${INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
fi

say "Install dir detected:  ${W}${INSTALL_DIR}${N}"

# Big warning
echo ""
echo -e "  ${R}${BLD}⚠  DANGER ZONE${N}"
echo -e "  ${W}This will permanently delete:${N}"
echo -e "  ${D}•${N} All deployed apps + containers"
echo -e "  ${D}•${N} All databases (Postgres, Redis, MariaDB)"
echo -e "  ${D}•${N} All user accounts + projects"
echo -e "  ${D}•${N} CloudDabba install directory"
[ "$KEEP_SSL" -eq 0 ]     && echo -e "  ${D}•${N} Let's Encrypt SSL certificates"
[ "$KEEP_MARIADB" -eq 0 ] && echo -e "  ${D}•${N} MariaDB server + data"
echo ""

if ! confirm "Proceed with FULL uninstall?"; then
  err "Aborted by user"
  exit 1
fi

# ============================================
# 1. Stop PM2 process
# ============================================
section "1. PM2 — stop clouddabba-api"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 show clouddabba-api >/dev/null 2>&1; then
    pm2 delete clouddabba-api 2>/dev/null && ok "clouddabba-api deleted" || wrn "Delete failed (may not have been running)"
    pm2 save --force 2>/dev/null || true
    ok "PM2 state saved"
  else
    say "clouddabba-api not running in PM2"
  fi
else
  say "pm2 not installed, skipping"
fi

# ============================================
# 2. Docker containers + volumes
# ============================================
if [ "$KEEP_DOCKER" -eq 0 ]; then
  section "2. Docker — containers, volumes, networks"

  if command -v docker >/dev/null 2>&1; then
    # Stop/remove platform containers
    for name in clouddabba-db clouddabba-redis; do
      if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
        docker rm -f "$name" >/dev/null 2>&1 && ok "Removed container: ${name}"
      fi
    done

    # Remove deployed app containers (any container with label or name prefix)
    app_containers=$(docker ps -a --format '{{.Names}}' | grep -E '^clouddabba-app-' || true)
    if [ -n "$app_containers" ]; then
      echo "$app_containers" | while read -r c; do
        [ -z "$c" ] && continue
        docker rm -f "$c" >/dev/null 2>&1 && ok "Removed app container: ${c}"
      done
    fi

    # docker-compose down if available
    if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
      cd "$INSTALL_DIR" || true
      if docker compose version >/dev/null 2>&1; then
        docker compose down -v 2>/dev/null && ok "docker compose down -v"
      elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose down -v 2>/dev/null && ok "docker-compose down -v"
      fi
      cd - >/dev/null 2>&1 || true
    fi

    # Remove leftover volumes
    for vol in postgres_data redis_data clouddabba_postgres_data clouddabba_redis_data; do
      if docker volume ls --format '{{.Name}}' | grep -q "^${vol}$"; then
        docker volume rm "$vol" >/dev/null 2>&1 && ok "Removed volume: ${vol}"
      fi
    done

    # Remove network
    if docker network ls --format '{{.Name}}' | grep -q '^clouddabba$'; then
      docker network rm clouddabba >/dev/null 2>&1 && ok "Removed network: clouddabba"
    fi

    # Remove clouddabba/* images
    images=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^clouddabba/' || true)
    if [ -n "$images" ]; then
      echo "$images" | while read -r img; do
        [ -z "$img" ] && continue
        docker rmi -f "$img" >/dev/null 2>&1 && ok "Removed image: ${img}"
      done
    fi
  else
    say "docker not installed, skipping"
  fi
else
  say "--keep-docker: skipping Docker cleanup"
fi

# ============================================
# 3. NGINX configs
# ============================================
section "3. NGINX — remove CloudDabba site configs"
removed_any=0
for dir in /etc/nginx/sites-enabled /etc/nginx/sites-available; do
  [ ! -d "$dir" ] && continue
  # Main platform config
  for pat in clouddabba clouddabba.conf; do
    if [ -f "${dir}/${pat}" ]; then
      rm -f "${dir}/${pat}" && ok "Removed ${dir}/${pat}"
      removed_any=1
    fi
  done
  # Per-subdomain configs — heuristic: files that reference the subdomain proxy pattern to 127.0.0.1:1xxxx
  for f in "${dir}"/*.conf; do
    [ -f "$f" ] || continue
    if grep -qE 'proxy_pass http://127\.0\.0\.1:1[0-9]{4}' "$f" 2>/dev/null; then
      rm -f "$f" && ok "Removed app config: $(basename "$f")"
      removed_any=1
    fi
  done
done
if [ "$removed_any" -eq 1 ]; then
  nginx -t >/dev/null 2>&1 && nginx -s reload 2>/dev/null && ok "nginx reloaded" || wrn "nginx reload failed — run 'nginx -t' to debug"
else
  say "No CloudDabba nginx configs found"
fi

# ============================================
# 4. Let's Encrypt SSL
# ============================================
if [ "$KEEP_SSL" -eq 0 ]; then
  section "4. Let's Encrypt — remove certificates"
  if [ -d /etc/letsencrypt/live ]; then
    if confirm "Delete ALL Let's Encrypt certificates on this server?"; then
      # List every cert via certbot
      if command -v certbot >/dev/null 2>&1; then
        certs=$(certbot certificates 2>/dev/null | awk '/Certificate Name:/ {print $3}')
        for c in $certs; do
          certbot delete --cert-name "$c" --non-interactive >/dev/null 2>&1 && ok "Deleted cert: ${c}"
        done
      fi
      # Fallback hard cleanup
      rm -rf /etc/letsencrypt/live/* /etc/letsencrypt/archive/* /etc/letsencrypt/renewal/* 2>/dev/null
      ok "Let's Encrypt certs removed"
    else
      say "Skipped (kept SSL)"
    fi
  else
    say "No Let's Encrypt certs found"
  fi
else
  say "--keep-ssl: skipping SSL cleanup"
fi

# ============================================
# 5. MariaDB
# ============================================
if [ "$KEEP_MARIADB" -eq 0 ]; then
  section "5. MariaDB — stop, purge, remove data"
  if command -v mariadb >/dev/null 2>&1 || systemctl list-unit-files | grep -q '^mariadb\.service'; then
    systemctl stop mariadb 2>/dev/null || true
    systemctl disable mariadb 2>/dev/null || true
    apt-get purge -y mariadb-server mariadb-client mariadb-common 'mariadb-*' >/dev/null 2>&1 && ok "mariadb packages purged"
    apt-get autoremove -y >/dev/null 2>&1 || true
    rm -rf /var/lib/mysql /etc/mysql 2>/dev/null && ok "/var/lib/mysql + /etc/mysql removed"
  else
    say "MariaDB not installed"
  fi
else
  say "--keep-mariadb: skipping"
fi

# ============================================
# 6. UFW rules
# ============================================
section "6. UFW — remove Docker bridge allowances"
if command -v ufw >/dev/null 2>&1; then
  for port in 5432 6379 3306; do
    ufw delete allow from 172.17.0.0/16 to any port "$port" 2>/dev/null && ok "Removed UFW rule for port ${port}" || true
  done
  # Panel port (6050) is shared infra — leave alone unless fully uninstalling
else
  say "ufw not installed, skipping"
fi

# ============================================
# 7. Install directory
# ============================================
section "7. Install directory — delete ${INSTALL_DIR}"
if [ -d "$INSTALL_DIR" ] && [ "$INSTALL_DIR" != "/" ]; then
  # Sanity: only delete if it looks like a CloudDabba install
  if [ -f "$INSTALL_DIR/install.sh" ] || [ -d "$INSTALL_DIR/backend" ] || [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    if confirm "Remove ${INSTALL_DIR} (all backend+frontend code, .env, logs)?"; then
      # Extract self if we're running from inside the dir
      script_self="$(readlink -f "$0")"
      if [[ "$script_self" == "$INSTALL_DIR"* ]]; then
        tmp="/tmp/clouddabba-uninstall-copy-$$.sh"
        cp "$script_self" "$tmp"
        chmod +x "$tmp"
        rm -rf "$INSTALL_DIR"
        ok "Removed ${INSTALL_DIR}"
        ok "(Script relocated to ${tmp} in case you need to re-run)"
      else
        rm -rf "$INSTALL_DIR"
        ok "Removed ${INSTALL_DIR}"
      fi
    else
      say "Skipped"
    fi
  else
    wrn "${INSTALL_DIR} doesn't look like a CloudDabba install — skipping for safety"
  fi
else
  say "Directory already gone"
fi

# ============================================
# Done
# ============================================
echo ""
echo -e "  ${G}${BLD}╔═══════════════════════════════════════════════╗${N}"
echo -e "  ${G}${BLD}║     ✓  CloudDabba Uninstalled                 ║${N}"
echo -e "  ${G}${BLD}╚═══════════════════════════════════════════════╝${N}"
echo ""
echo -e "  ${W}Fresh install:${N}"
echo -e "  ${C}curl -fsSL https://raw.githubusercontent.com/niteshpawar97/CloudDabba/master/install.sh | sudo bash${N}"
echo ""
echo -e "  ${D}Note: Docker daemon, Node.js, nginx, and ufw were left installed.${N}"
echo -e "  ${D}Remove manually if no longer needed: apt purge docker-ce nginx nodejs ufw${N}"
echo ""
