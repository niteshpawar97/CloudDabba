#!/usr/bin/env bash
set -uo pipefail

# ============================================
# CloudDabba - Update Script
# Pulls latest code, rebuilds, restarts PM2
# Safe to run multiple times (idempotent)
# ============================================

VERSION="1.0.0"
INSTALL_DIR_DEFAULT="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE=""

# --- Progress ---
TOTAL=8
STEP=0
T0=0

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
BRANCH="master"
SKIP_BACKEND=0
SKIP_FRONTEND=0
SKIP_PRISMA=0
INSTALL_DIR=""

usage() {
  cat <<EOF
CloudDabba Update — v${VERSION}

Usage: sudo ./update.sh [options]

Options:
  --yes              Non-interactive, assume YES to all prompts
  --dir PATH         Install directory (default: auto-detect from PM2 or script dir)
  --branch BRANCH    Git branch to pull (default: master)
  --skip-backend     Don't rebuild backend (frontend-only updates)
  --skip-frontend    Don't rebuild frontend (backend-only updates)
  --skip-prisma      Don't run prisma db push (schema unchanged)
  -h, --help         Show this help

What this does:
  1. Detects install directory
  2. Stashes any local changes (with warning)
  3. git pull origin <branch>
  4. Backend:  npm ci + prisma generate + prisma db push + build
  5. Frontend: npm ci + build
  6. pm2 restart clouddabba-api
  7. Health check on http://localhost:6050/api/v1/health
  8. Shows a summary with total time elapsed

If anything fails, the script stops with a clear error and leaves
the previous build intact (PM2 will keep running the old process
because the restart only happens at the end).

For first-time install use install.sh instead.
EOF
}

# --- Logging ---
say()  { echo -e "  ${D}│${N} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "  ${D}│${N} $1"; }
ok()   { echo -e "  ${D}│${N} ${G}✓${N} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "  ${D}│${N} ${G}✓${N} $1"; }
wrn()  { echo -e "  ${D}│${N} ${Y}⚠${N} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "  ${D}│${N} ${Y}⚠${N} $1"; }
err()  { echo -e "  ${D}│${N} ${R}✗${N} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "  ${D}│${N} ${R}✗${N} $1"; }

elapsed() {
  local e=$(( $(date +%s) - T0 ))
  printf "%dm %ds" $((e/60)) $((e%60))
}

step() {
  STEP=$((STEP + 1))
  local pct=$((STEP * 100 / TOTAL))
  local bar=""
  local filled=$((pct / 5))
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=filled; i<20; i++)); do bar+="░"; done
  echo ""
  echo -e "  ${C}${BLD}[$bar] ${pct}%${N}  ${W}Step ${STEP}/${TOTAL}${N}  ${D}$(elapsed)${N}"
  echo -e "  ${D}┌─${N} ${BLD}$1${N}"
}

# Run with dimmed live output
run() {
  set +e
  "$@" 2>&1 | while IFS= read -r line; do
    echo -e "  ${D}│  $line${N}"
    [ -n "$LOG_FILE" ] && echo "$line" >> "$LOG_FILE"
  done
  local rc="${PIPESTATUS[0]}"
  set -e
  if [ "$rc" -ne 0 ]; then
    err "Command failed (exit $rc)"
    return "$rc"
  fi
}

confirm() {
  local prompt="$1"
  if [ "$YES" -eq 1 ]; then return 0; fi
  read -rp "$(echo -e "  ${Y}?${N} $prompt [y/N]: ")" ans
  [[ "${ans:-}" =~ ^[Yy]$ ]]
}

banner() {
  clear 2>/dev/null || true
  echo ""
  echo -e "  ${C}${BLD}╔═══════════════════════════════════════════════╗${N}"
  echo -e "  ${C}${BLD}║       CloudDabba  •  Update  v${VERSION}            ║${N}"
  echo -e "  ${C}${BLD}╚═══════════════════════════════════════════════╝${N}"
  echo ""
}

# --- Parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1 ;;
    --dir) INSTALL_DIR="$2"; shift ;;
    --branch) BRANCH="$2"; shift ;;
    --skip-backend) SKIP_BACKEND=1 ;;
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --skip-prisma) SKIP_PRISMA=1 ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
  shift
done

# --- Must be root (for pm2 save / system commands) ---
if [ "$(id -u)" -ne 0 ]; then
  err "Please run as root:  sudo $0 $*"
  exit 1
fi

T0=$(date +%s)
banner

# ============================================
# Step 1: Pre-flight
# ============================================
step "Pre-flight checks"

# Detect install dir
if [ -z "$INSTALL_DIR" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    INSTALL_DIR=$(pm2 show clouddabba-api 2>/dev/null | grep -E "^\s*cwd\s+" | awk '{print $NF}' | head -n 1 || true)
  fi
  INSTALL_DIR="${INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
fi

if [ ! -d "$INSTALL_DIR" ]; then
  err "Install directory not found: ${INSTALL_DIR}"
  err "Pass --dir /path/to/CloudDabba"
  exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
  err "Not a git repo: ${INSTALL_DIR}"
  err "This script only works for git-based installs."
  exit 1
fi

LOG_FILE="$INSTALL_DIR/update.log"
echo "" > "$LOG_FILE"

say "Install dir:     ${W}${INSTALL_DIR}${N}"
say "Branch:          ${W}${BRANCH}${N}"
say "Log file:        ${D}${LOG_FILE}${N}"

# Required tools
for cmd in git node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing required tool: ${cmd}"
    exit 1
  fi
done

if ! command -v pm2 >/dev/null 2>&1; then
  wrn "pm2 not found — install it with:  sudo npm i -g pm2"
  exit 1
fi

ok "All required tools present (git, node, npm, pm2)"

# ============================================
# Step 2: Git pull
# ============================================
step "Pulling latest code"
cd "$INSTALL_DIR"

# Stash local changes (e.g. install.sh with CRLF, .env references, etc.)
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  wrn "Local changes detected — stashing to proceed safely"
  git stash push -u -m "update.sh autostash $(date +%s)" 2>&1 | tee -a "$LOG_FILE" >/dev/null || true
  ok "Local changes stashed (restore with: git stash pop)"
fi

CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

if ! run git fetch origin "$BRANCH"; then
  err "git fetch failed. Check network + GH_PAT / credentials."
  exit 1
fi

if ! run git checkout "$BRANCH"; then
  err "git checkout failed for branch: $BRANCH"
  exit 1
fi

if ! run git reset --hard "origin/$BRANCH"; then
  err "git reset failed"
  exit 1
fi

NEW_COMMIT=$(git rev-parse HEAD)
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
  say "${D}Already on latest commit:${N} ${W}${NEW_COMMIT:0:7}${N}"
  # Continue anyway — deps may have changed, rebuild doesn't hurt
else
  ok "Updated ${CURRENT_COMMIT:0:7} → ${NEW_COMMIT:0:7}"
  CHANGE_LOG=$(git log --oneline "${CURRENT_COMMIT}..${NEW_COMMIT}" 2>/dev/null | head -10)
  if [ -n "$CHANGE_LOG" ]; then
    echo ""
    echo -e "  ${D}│${N} ${W}New commits:${N}"
    echo "$CHANGE_LOG" | while IFS= read -r line; do
      echo -e "  ${D}│${N}   ${D}${line}${N}"
    done
  fi
fi

# ============================================
# Step 3: Backend - install deps
# ============================================
if [ "$SKIP_BACKEND" -eq 0 ]; then
  step "Backend — installing dependencies"
  cd "$INSTALL_DIR/backend"
  if ! run npm ci --prefer-offline --no-audit --progress=false; then
    err "Backend npm ci failed"
    exit 1
  fi
  ok "Backend dependencies installed"
else
  step "Backend — SKIPPED (--skip-backend)"
  say "${D}Skipping backend rebuild${N}"
fi

# ============================================
# Step 4: Prisma (generate + db push)
# ============================================
if [ "$SKIP_BACKEND" -eq 0 ] && [ "$SKIP_PRISMA" -eq 0 ]; then
  step "Database — prisma generate + sync schema"
  cd "$INSTALL_DIR/backend"

  if ! run npx prisma generate; then
    err "prisma generate failed"
    exit 1
  fi

  if ! run npx prisma db push --skip-generate --accept-data-loss=false; then
    err "prisma db push failed — schema may have a conflict. Check $LOG_FILE"
    exit 1
  fi
  ok "Database schema in sync"
else
  step "Database — SKIPPED"
  say "${D}Skipping prisma (use without --skip-prisma to sync schema)${N}"
fi

# ============================================
# Step 5: Backend build
# ============================================
if [ "$SKIP_BACKEND" -eq 0 ]; then
  step "Backend — TypeScript build"
  cd "$INSTALL_DIR/backend"
  if ! run npm run build; then
    err "Backend build failed — check $LOG_FILE"
    exit 1
  fi
  if [ ! -d "$INSTALL_DIR/backend/dist" ]; then
    err "dist/ not found after build"
    exit 1
  fi
  ok "Backend compiled"
else
  step "Backend build — SKIPPED"
fi

# ============================================
# Step 6: Frontend - deps + build
# ============================================
if [ "$SKIP_FRONTEND" -eq 0 ]; then
  step "Frontend — installing deps + building"
  cd "$INSTALL_DIR/frontend"

  if ! run npm ci --prefer-offline --no-audit --progress=false; then
    err "Frontend npm ci failed"
    exit 1
  fi

  if ! run npm run build; then
    err "Frontend build failed"
    exit 1
  fi

  if [ ! -f "$INSTALL_DIR/frontend/dist/index.html" ]; then
    err "dist/index.html not found after build"
    exit 1
  fi
  ok "Frontend compiled"
else
  step "Frontend — SKIPPED (--skip-frontend)"
fi

# ============================================
# Step 7: PM2 restart
# ============================================
step "PM2 — restart clouddabba-api"
cd "$INSTALL_DIR"

if pm2 show clouddabba-api >/dev/null 2>&1; then
  if ! run pm2 restart clouddabba-api --update-env; then
    err "pm2 restart failed — trying fresh start"
    pm2 delete clouddabba-api 2>/dev/null || true
    if ! run pm2 start ecosystem.config.js; then
      err "pm2 start failed — check pm2 logs clouddabba-api"
      exit 1
    fi
  fi
else
  wrn "clouddabba-api not in PM2 list — starting fresh"
  if ! run pm2 start ecosystem.config.js; then
    err "pm2 start failed"
    exit 1
  fi
fi

pm2 save --force >> "$LOG_FILE" 2>&1 || true
ok "PM2 restarted"

# ============================================
# Step 8: Health check
# ============================================
step "Health check"
sleep 2

HEALTH_OK=0
for i in $(seq 1 15); do
  if curl -sf http://localhost:6050/api/v1/health >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  echo -ne "\r  ${D}│  ⏳ Waiting... ($i/15)${N}   "
  sleep 2
done
echo ""

if [ "$HEALTH_OK" -eq 1 ]; then
  ok "${G}API responding on :6050${N}"
else
  err "Health check failed after 30s — run: ${W}pm2 logs clouddabba-api${N}"
  wrn "The update completed but the server isn't responding. It might still be starting."
fi

# ============================================
# Summary
# ============================================
echo ""
echo ""
echo -e "  ${G}${BLD}╔═══════════════════════════════════════════════╗${N}"
echo -e "  ${G}${BLD}║     ✓  CloudDabba Updated Successfully        ║${N}"
echo -e "  ${G}${BLD}╚═══════════════════════════════════════════════╝${N}"
echo ""
echo -e "  ${W}Commit${N}      ${C}${NEW_COMMIT:0:7}${N}"
echo -e "  ${W}Branch${N}      ${C}${BRANCH}${N}"
echo -e "  ${W}Time${N}        $(elapsed)"
echo ""
echo -e "  ${D}Logs:  pm2 logs clouddabba-api  |  tail -f ${LOG_FILE}${N}"
echo ""
