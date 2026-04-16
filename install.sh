#!/usr/bin/env bash
set -euo pipefail

# ============================================
# CloudDabba - One-Click Install Script
# Self-hosted PaaS Platform
# ============================================

CLOUDDABBA_VERSION="1.5.0"
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$INSTALL_DIR/install.log"
ROLLBACK_ACTIONS=()

# --- Progress Tracking ---
TOTAL_STEPS=12
CURRENT_STEP=0
START_TIME=0

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}[  OK]${NC} $1" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[ ERR]${NC} $1" | tee -a "$LOG_FILE"; }

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  local pct=$((CURRENT_STEP * 100 / TOTAL_STEPS))
  local elapsed=$(( $(date +%s) - START_TIME ))
  local mins=$((elapsed / 60))
  local secs=$((elapsed % 60))
  echo ""
  echo -e "${CYAN}${BOLD}━━━ Step ${CURRENT_STEP}/${TOTAL_STEPS} [${pct}%] ━━━━━━━━━━━━━━━━━━━━━ ${GRAY}${mins}m ${secs}s elapsed${NC}"
  info "$1"
}

# Run a command with live output (dimmed) + log
run() {
  set +e
  "$@" 2>&1 | while IFS= read -r line; do
    echo -e "${GRAY}       $line${NC}"
    echo "$line" >> "$LOG_FILE"
  done
  local exit_code="${PIPESTATUS[0]}"
  set -e
  if [ "$exit_code" -ne 0 ]; then
    error "Command failed: $1 (exit code: $exit_code)"
    return "$exit_code"
  fi
  return 0
}

# Run silently (only log, no screen output)
run_quiet() {
  "$@" >> "$LOG_FILE" 2>&1
}

rollback() {
  if [ ${#ROLLBACK_ACTIONS[@]} -gt 0 ]; then
    error "Installation failed! Rolling back..."
    for ((i=${#ROLLBACK_ACTIONS[@]}-1; i>=0; i--)); do
      eval "${ROLLBACK_ACTIONS[$i]}" 2>/dev/null || true
    done
    error "Rollback complete. Check $LOG_FILE for details."
  fi
}
trap rollback ERR

print_banner() {
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║         CloudDabba Installer           ║"
  echo "  ║       Self-hosted PaaS Platform        ║"
  echo "  ║            v${CLOUDDABBA_VERSION}                    ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${NC}"
}

# --- OS Detection ---
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="$ID"
    OS_VERSION="$VERSION_ID"
    success "Detected: $PRETTY_NAME"
  else
    error "Unsupported OS. Requires Ubuntu 22.04+ or Debian 12+"
    exit 1
  fi
}

# --- Dependency Installation ---
install_if_missing() {
  local cmd="$1" pkg="$2"
  if command -v "$cmd" &>/dev/null; then
    success "$cmd already installed"
  else
    info "Installing $pkg..."
    run sudo apt-get install -y "$pkg"
    success "$pkg installed"
  fi
}

check_and_install_deps() {
  info "Updating package list..."
  run sudo apt-get update -qq

  # Docker
  if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    run sudo apt-get install -y docker.io
    run_quiet sudo systemctl enable docker
    run_quiet sudo systemctl start docker
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    success "Docker installed"
  else
    success "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
  fi

  # Node.js 22
  if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
    info "Installing Node.js 22..."
    run bash -c "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    run sudo apt-get install -y nodejs
    success "Node.js $(node -v) installed"
  else
    success "Node.js $(node -v) already installed"
  fi

  # NGINX
  install_if_missing nginx nginx

  # PM2
  if ! command -v pm2 &>/dev/null; then
    info "Installing PM2..."
    run sudo npm install -g pm2
    success "PM2 installed"
  else
    success "PM2 already installed"
  fi

  # Certbot
  install_if_missing certbot certbot
  run_quiet sudo apt-get install -y python3-certbot-nginx || true

  echo ""
  success "All dependencies ready!"
}

# --- Server IP Detection ---
detect_server_ip() {
  SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
              curl -s --max-time 5 https://ifconfig.me/ip 2>/dev/null || \
              hostname -I | awk '{print $1}')
  success "Server IP: $SERVER_IP"
}

# --- Interactive Prompts ---
prompt_configuration() {
  echo ""
  read -rp "$(echo -e "${BLUE}Domain${NC} (e.g., clouddabba.yourdomain.com) [${SERVER_IP}]: ")" DOMAIN
  DOMAIN="${DOMAIN:-$SERVER_IP}"

  read -rp "$(echo -e "${BLUE}Admin Email${NC} [admin@${DOMAIN}]: ")" ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

  while true; do
    read -rsp "$(echo -e "${BLUE}Admin Password${NC} (min 8 chars): ")" ADMIN_PASSWORD
    echo ""
    if [ ${#ADMIN_PASSWORD} -ge 8 ]; then break; fi
    warn "Password must be at least 8 characters"
  done

  read -rp "$(echo -e "${BLUE}Admin Name${NC} [Admin]: ")" ADMIN_NAME
  ADMIN_NAME="${ADMIN_NAME:-Admin}"

  echo ""
  success "Domain: $DOMAIN | Email: $ADMIN_EMAIL | Name: $ADMIN_NAME"
}

# --- Secret Generation ---
generate_secrets() {
  JWT_SECRET=$(openssl rand -base64 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  success "JWT secret, encryption key, DB & Redis passwords generated"
}

# --- Environment File ---
generate_env_file() {
  if [ "$DOMAIN" = "$SERVER_IP" ]; then
    CORS_ORIGIN="http://${SERVER_IP}:6050"
  else
    CORS_ORIGIN="http://${DOMAIN},https://${DOMAIN}"
  fi

  cat > "$INSTALL_DIR/backend/.env" << EOF
NODE_ENV=production
PORT=6050
API_VERSION=v1

DATABASE_URL=postgresql://clouddabba:${DB_PASSWORD}@localhost:5432/clouddabba

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=7d

ENCRYPTION_KEY=${ENCRYPTION_KEY}

BASE_DOMAIN=${DOMAIN}

DOCKER_SOCKET=/var/run/docker.sock

NGINX_SITES_PATH=/etc/nginx/sites-enabled
NGINX_RELOAD_CMD=sudo nginx -s reload

PORT_RANGE_START=10000
PORT_RANGE_END=20000

CORS_ORIGIN=${CORS_ORIGIN}
LOG_LEVEL=info

PROVISION_DB_ADMIN_URL=postgresql://clouddabba:${DB_PASSWORD}@localhost:5432/postgres
PROVISION_DB_HOST=172.17.0.1
PROVISION_DB_PORT=5432

REDIS_HOST=172.17.0.1
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

MARIADB_ADMIN_HOST=localhost
MARIADB_ADMIN_PORT=3306
MARIADB_ADMIN_USER=root
MARIADB_ADMIN_PASSWORD=
MARIADB_HOST=172.17.0.1
MARIADB_PORT=3306
EOF

  export DB_PASSWORD REDIS_PASSWORD
  success "Environment file written to backend/.env"
}

# --- Database Setup ---
setup_databases() {
  cd "$INSTALL_DIR"
  export DB_PASSWORD

  # Support both "docker compose" (v2) and "docker-compose" (v1)
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    info "Installing docker-compose plugin..."
    run sudo apt-get install -y docker-compose-v2 || run sudo apt-get install -y docker-compose
  fi
  COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

  run $COMPOSE_CMD up -d

  ROLLBACK_ACTIONS+=("cd '$INSTALL_DIR' && $COMPOSE_CMD down 2>/dev/null")

  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec clouddabba-db pg_isready -U clouddabba &>/dev/null; then
      success "PostgreSQL ready | Redis ready"
      return
    fi
    echo -e "${GRAY}       Waiting... ($i/30)${NC}"
    sleep 2
  done
  error "PostgreSQL did not start in time"
  exit 1
}

# --- Build Application ---
build_backend() {
  cd "$INSTALL_DIR/backend"

  info "Installing npm packages..."
  run npm ci --production=false

  info "Generating Prisma client..."
  run npx prisma generate

  info "Pushing database schema..."
  run npx prisma db push

  info "Compiling TypeScript..."
  run npm run build

  if [ ! -f "$INSTALL_DIR/backend/dist/server.js" ]; then
    error "Backend build failed - dist/server.js not found"
    exit 1
  fi
  success "Backend compiled successfully"

  # Seed database
  info "Seeding database..."
  run npx prisma db seed || true
  success "Database seeded"
}

build_frontend() {
  cd "$INSTALL_DIR/frontend"

  info "Installing npm packages..."
  run npm ci

  info "Compiling React + Vite..."
  run npm run build

  if [ ! -f "$INSTALL_DIR/frontend/dist/index.html" ]; then
    error "Frontend build failed - dist/index.html not found"
    exit 1
  fi
  success "Frontend compiled successfully"
}

# --- NGINX Configuration ---
setup_nginx() {
  local TEMPLATE="$INSTALL_DIR/nginx/clouddabba.conf.template"
  local NGINX_CONF="/etc/nginx/nginx.conf"

  if [ -f "$TEMPLATE" ]; then
    sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup" 2>/dev/null || true
    ROLLBACK_ACTIONS+=("sudo cp '${NGINX_CONF}.backup' '$NGINX_CONF' && sudo nginx -s reload")

    sed "s/__DOMAIN__/${DOMAIN}/g" "$TEMPLATE" | sudo tee "$NGINX_CONF" > /dev/null
    sudo mkdir -p /etc/nginx/sites-enabled

    if sudo nginx -t >> "$LOG_FILE" 2>&1; then
      sudo systemctl reload nginx >> "$LOG_FILE" 2>&1
      success "NGINX configured for ${DOMAIN}"
    else
      error "NGINX config test failed"
      exit 1
    fi
  else
    warn "NGINX template not found, skipping"
  fi

  # Firewall
  if command -v ufw &>/dev/null && sudo ufw status 2>/dev/null | grep -q "active"; then
    info "Adding firewall rules..."
    sudo ufw allow 80/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow 443/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow from 172.17.0.0/16 to any port 5432 >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow from 172.17.0.0/16 to any port 6379 >> "$LOG_FILE" 2>&1 || true
    success "Firewall rules added"
  fi
}

# --- SSL Setup ---
setup_ssl() {
  if [ "$DOMAIN" = "$SERVER_IP" ]; then
    warn "Using IP address - SSL skipped (requires a domain name)"
    return
  fi

  info "Checking DNS for ${DOMAIN}..."
  RESOLVED_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1)

  if [ "$RESOLVED_IP" = "$SERVER_IP" ]; then
    info "DNS verified! Issuing SSL certificate..."
    if sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" 2>&1 | tee -a "$LOG_FILE"; then
      success "SSL certificate installed"
    else
      warn "SSL failed. Run later: sudo certbot --nginx -d ${DOMAIN}"
    fi
  else
    warn "DNS not pointing here (expected: ${SERVER_IP}, got: ${RESOLVED_IP:-none})"
    warn "After DNS setup, run: sudo certbot --nginx -d ${DOMAIN}"
  fi
}

# --- PM2 Setup ---
setup_pm2() {
  cd "$INSTALL_DIR"
  pm2 delete clouddabba-api 2>/dev/null || true
  run pm2 start ecosystem.config.js
  ROLLBACK_ACTIONS+=("pm2 delete clouddabba-api 2>/dev/null")

  run_quiet pm2 save
  pm2 startup 2>&1 | grep "sudo" | bash >> "$LOG_FILE" 2>&1 || true
  success "PM2 started + auto-start on reboot"

  # Verify
  info "Verifying health..."
  sleep 3
  for i in $(seq 1 10); do
    if curl -sf http://localhost:6050/api/v1/health > /dev/null 2>&1; then
      success "Health check passed!"
      return
    fi
    echo -e "${GRAY}       Waiting for server... ($i/10)${NC}"
    sleep 2
  done
  warn "Health check pending - server may still be starting"
}

# --- Summary ---
print_summary() {
  local URL
  if [ "$DOMAIN" = "$SERVER_IP" ]; then
    URL="http://${SERVER_IP}:6050"
  else
    URL="https://${DOMAIN}"
  fi

  local total_elapsed=$(( $(date +%s) - START_TIME ))
  local total_mins=$((total_elapsed / 60))
  local total_secs=$((total_elapsed % 60))

  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       CloudDabba Installed Successfully!       ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Platform URL:${NC}   ${URL}"
  echo -e "  ${CYAN}Setup Wizard:${NC}   ${URL}/setup"
  echo -e "  ${CYAN}Admin Email:${NC}    ${ADMIN_EMAIL}"
  echo -e "  ${CYAN}Total Time:${NC}     ${total_mins}m ${total_secs}s"
  echo ""
  echo -e "  ${YELLOW}Next Step:${NC} Open the Setup Wizard URL above in your browser"
  echo -e "             to complete the platform configuration."
  echo ""
  echo -e "  ${BLUE}Install Log:${NC}  $LOG_FILE"
  echo -e "  ${BLUE}App Logs:${NC}     pm2 logs clouddabba-api"
  echo ""
}

# ============================================
# MAIN
# ============================================
main() {
  echo "" > "$LOG_FILE"
  START_TIME=$(date +%s)
  print_banner

  step "Detecting operating system"
  detect_os

  step "Installing dependencies"
  check_and_install_deps

  step "Detecting server IP"
  detect_server_ip

  step "Platform configuration"
  prompt_configuration

  step "Generating security keys"
  generate_secrets

  step "Generating environment config"
  generate_env_file

  step "Starting PostgreSQL & Redis"
  setup_databases

  step "Building backend"
  build_backend

  step "Building frontend"
  build_frontend

  step "Configuring NGINX & firewall"
  setup_nginx

  step "Setting up SSL"
  setup_ssl

  step "Starting CloudDabba"
  setup_pm2

  print_summary
}

main "$@"
