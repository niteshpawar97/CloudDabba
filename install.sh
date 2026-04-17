#!/usr/bin/env bash
set -euo pipefail

# ============================================
# CloudDabba - One-Click Install Script
# Self-hosted PaaS Platform
# ============================================

VERSION="1.5.0"
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$INSTALL_DIR/install.log"
ROLLBACK_ACTIONS=()

# --- Progress ---
TOTAL=13
STEP=0
T0=0

# --- Colors ---
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
C='\033[0;36m'
D='\033[0;90m'
W='\033[1;37m'
BLD='\033[1m'
DIM='\033[2m'
N='\033[0m'

# --- Logging ---
log()  { echo "$1" >> "$LOG_FILE"; }
info() { echo -e "  ${D}│${N} $1" | tee -a "$LOG_FILE"; }
ok()   { echo -e "  ${D}│${N} ${G}✓${N} $1" | tee -a "$LOG_FILE"; }
wrn()  { echo -e "  ${D}│${N} ${Y}⚠${N} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "  ${D}│${N} ${R}✗${N} $1" | tee -a "$LOG_FILE"; }

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
    echo "$line" >> "$LOG_FILE"
  done
  local rc="${PIPESTATUS[0]}"
  set -e
  if [ "$rc" -ne 0 ]; then
    err "Command failed (exit $rc)"
    return "$rc"
  fi
}

run_quiet() { "$@" >> "$LOG_FILE" 2>&1; }

rollback() {
  if [ ${#ROLLBACK_ACTIONS[@]} -gt 0 ]; then
    err "Installation failed! Rolling back..."
    for ((i=${#ROLLBACK_ACTIONS[@]}-1; i>=0; i--)); do
      eval "${ROLLBACK_ACTIONS[$i]}" 2>/dev/null || true
    done
    err "Rollback done. See $LOG_FILE"
  fi
}
trap rollback ERR

banner() {
  local w=45
  local title="CloudDabba Installer"
  local sub="Self-hosted PaaS Platform"
  local ver="v${VERSION}"
  echo ""
  echo -e "  ${C}╔$(printf '═%.0s' $(seq 1 $w))╗${N}"
  printf "  ${C}║${N}${BLD}%*s${N}${C}║${N}\n" $(( (w + ${#title}) / 2 )) "$title"
  printf "  ${C}║${N}${D}%*s${N}${C}║${N}\n" $(( (w + ${#sub}) / 2 )) "$sub"
  printf "  ${C}║${N}${D}%*s${N}${C}║${N}\n" $(( (w + ${#ver}) / 2 )) "$ver"
  echo -e "  ${C}╚$(printf '═%.0s' $(seq 1 $w))╝${N}"
  echo ""
}

# ============================================
# FUNCTIONS
# ============================================

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="$ID"
    OS_VERSION="$VERSION_ID"
    ok "Detected: $PRETTY_NAME"
  else
    err "Unsupported OS. Requires Ubuntu 22.04+ or Debian 12+"
    exit 1
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
    ok "Docker installed"
  else
    ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
  fi

  # Node.js 22
  if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
    info "Installing Node.js 22..."
    run bash -c "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    run sudo apt-get install -y nodejs
    ok "Node.js $(node -v)"
  else
    ok "Node.js $(node -v)"
  fi

  # NGINX
  if command -v nginx &>/dev/null; then ok "NGINX"; else
    info "Installing NGINX..."; run sudo apt-get install -y nginx; ok "NGINX installed"; fi

  # PM2
  if command -v pm2 &>/dev/null; then ok "PM2"; else
    info "Installing PM2..."; run sudo npm install -g pm2; ok "PM2 installed"; fi

  # Certbot
  if command -v certbot &>/dev/null; then ok "Certbot"; else
    info "Installing Certbot..."; run sudo apt-get install -y certbot; ok "Certbot installed"; fi
  run_quiet sudo apt-get install -y python3-certbot-nginx || true

  # MariaDB (for database provisioning feature)
  if command -v mariadb &>/dev/null; then
    ok "MariaDB $(mariadb --version | awk '{print $5}' | tr -d ',')"
  else
    info "Installing MariaDB..."
    run sudo apt-get install -y mariadb-server
    run_quiet sudo systemctl enable mariadb
    run_quiet sudo systemctl start mariadb
    ok "MariaDB installed"
  fi

  echo -e "  ${D}└─${N} ${G}${BLD}All dependencies ready${N}"
}

configure_mariadb() {
  MARIADB_ADMIN_USER="clouddabba_admin"
  MARIADB_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')

  # Create/update admin user with remote access permission
  info "Creating MariaDB admin user..."
  if sudo mariadb -e "SELECT 1" &>/dev/null; then
    # Socket auth works — use directly
    sudo mariadb <<EOF >> "$LOG_FILE" 2>&1 || true
CREATE USER IF NOT EXISTS '${MARIADB_ADMIN_USER}'@'%' IDENTIFIED BY '${MARIADB_ADMIN_PASSWORD}';
ALTER USER '${MARIADB_ADMIN_USER}'@'%' IDENTIFIED BY '${MARIADB_ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON *.* TO '${MARIADB_ADMIN_USER}'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOF
    ok "Admin user '${MARIADB_ADMIN_USER}' created"
  else
    wrn "Cannot access MariaDB as root — skipping admin user creation"
    MARIADB_ADMIN_USER="root"
    MARIADB_ADMIN_PASSWORD=""
  fi

  # Enable remote access for Docker containers
  info "Configuring MariaDB for Docker access..."
  local CNF="/etc/mysql/mariadb.conf.d/50-server.cnf"
  if [ -f "$CNF" ]; then
    sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' "$CNF"
    sudo systemctl restart mariadb >> "$LOG_FILE" 2>&1
    ok "MariaDB listening on all interfaces"
  fi

  # Firewall rule
  if command -v ufw &>/dev/null && sudo ufw status 2>/dev/null | grep -q "active"; then
    sudo ufw allow from 172.17.0.0/16 to any port 3306 >> "$LOG_FILE" 2>&1 || true
  fi

  # Update .env with MariaDB credentials
  sed -i "s|^MARIADB_ADMIN_USER=.*|MARIADB_ADMIN_USER=${MARIADB_ADMIN_USER}|" "$INSTALL_DIR/backend/.env"
  sed -i "s|^MARIADB_ADMIN_PASSWORD=.*|MARIADB_ADMIN_PASSWORD=${MARIADB_ADMIN_PASSWORD}|" "$INSTALL_DIR/backend/.env"
  ok "MariaDB credentials saved to .env"
}

detect_server_ip() {
  SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
              curl -s --max-time 5 https://ifconfig.me/ip 2>/dev/null || \
              hostname -I | awk '{print $1}')
  ok "Server IP: ${W}$SERVER_IP${N}"
}

prompt_configuration() {
  echo ""
  read -rp "$(echo -e "  ${D}│${N} ${B}Domain${N} [${SERVER_IP}]: ")" DOMAIN
  DOMAIN="${DOMAIN:-$SERVER_IP}"

  read -rp "$(echo -e "  ${D}│${N} ${B}Admin Email${N} [admin@${DOMAIN}]: ")" ADMIN_EMAIL
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

  while true; do
    read -rsp "$(echo -e "  ${D}│${N} ${B}Admin Password${N} (min 8): ")" ADMIN_PASSWORD
    echo ""
    if [ ${#ADMIN_PASSWORD} -ge 8 ]; then break; fi
    wrn "Password must be at least 8 characters"
  done

  read -rp "$(echo -e "  ${D}│${N} ${B}Admin Name${N} [Admin]: ")" ADMIN_NAME
  ADMIN_NAME="${ADMIN_NAME:-Admin}"

  echo ""
  ok "Domain: ${W}$DOMAIN${N}"
  ok "Email:  ${W}$ADMIN_EMAIL${N}"
  ok "Name:   ${W}$ADMIN_NAME${N}"
}

generate_secrets() {
  JWT_SECRET=$(openssl rand -base64 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  ok "JWT, encryption key, DB & Redis passwords generated"
}

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
  ok "backend/.env written"
}

setup_databases() {
  cd "$INSTALL_DIR"
  export DB_PASSWORD

  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    info "Installing docker-compose..."
    run sudo apt-get install -y docker-compose-v2 || run sudo apt-get install -y docker-compose
  fi
  COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

  run $COMPOSE_CMD up -d
  ROLLBACK_ACTIONS+=("cd '$INSTALL_DIR' && $COMPOSE_CMD down 2>/dev/null")

  info "Waiting for PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec clouddabba-db pg_isready -U clouddabba &>/dev/null; then
      ok "PostgreSQL ${G}ready${N}"
      ok "Redis ${G}ready${N}"
      return
    fi
    echo -ne "\r  ${D}│  ⏳ Waiting... ($i/30)${N}   "
    sleep 2
  done
  echo ""
  err "PostgreSQL did not start in time"
  exit 1
}

build_backend() {
  cd "$INSTALL_DIR/backend"

  info "npm install..."
  run npm ci --production=false

  info "Prisma generate..."
  run npx prisma generate

  info "Database schema push..."
  run npx prisma db push

  info "TypeScript compile..."
  run npm run build

  if [ ! -f "$INSTALL_DIR/backend/dist/server.js" ]; then
    err "Build failed — dist/server.js not found"
    exit 1
  fi
  ok "Backend compiled"

  info "Seeding database..."
  run npx prisma db seed || true
  ok "Database seeded"
}

build_frontend() {
  cd "$INSTALL_DIR/frontend"

  info "npm install..."
  run npm ci

  info "Vite build..."
  run npm run build

  if [ ! -f "$INSTALL_DIR/frontend/dist/index.html" ]; then
    err "Build failed — dist/index.html not found"
    exit 1
  fi
  ok "Frontend compiled"
}

setup_nginx() {
  local TPL="$INSTALL_DIR/nginx/clouddabba.conf.template"
  local CONF="/etc/nginx/nginx.conf"

  if [ -f "$TPL" ]; then
    sudo cp "$CONF" "${CONF}.bak" 2>/dev/null || true
    ROLLBACK_ACTIONS+=("sudo cp '${CONF}.bak' '$CONF' && sudo nginx -s reload")

    sed "s/__DOMAIN__/${DOMAIN}/g" "$TPL" | sudo tee "$CONF" > /dev/null
    sudo mkdir -p /etc/nginx/sites-enabled

    if sudo nginx -t >> "$LOG_FILE" 2>&1; then
      sudo systemctl reload nginx >> "$LOG_FILE" 2>&1
      ok "NGINX → ${W}${DOMAIN}${N}"
    else
      err "NGINX config test failed"
      exit 1
    fi
  else
    wrn "NGINX template not found"
  fi

  if command -v ufw &>/dev/null && sudo ufw status 2>/dev/null | grep -q "active"; then
    sudo ufw allow 80/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow 443/tcp >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow from 172.17.0.0/16 to any port 5432 >> "$LOG_FILE" 2>&1 || true
    sudo ufw allow from 172.17.0.0/16 to any port 6379 >> "$LOG_FILE" 2>&1 || true
    ok "Firewall rules added"
  fi
}

setup_ssl() {
  if [ "$DOMAIN" = "$SERVER_IP" ]; then
    wrn "IP address — SSL skipped"
    return
  fi

  info "Checking DNS..."
  RESOLVED_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1)

  if [ "$RESOLVED_IP" = "$SERVER_IP" ]; then
    info "DNS verified → issuing certificate..."
    if sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" 2>&1 | tee -a "$LOG_FILE"; then
      ok "SSL certificate installed"
    else
      wrn "SSL failed. Run: sudo certbot --nginx -d ${DOMAIN}"
    fi
  else
    wrn "DNS not pointing here (${RESOLVED_IP:-none} ≠ ${SERVER_IP})"
    wrn "Run later: sudo certbot --nginx -d ${DOMAIN}"
  fi
}

setup_pm2() {
  cd "$INSTALL_DIR"
  pm2 delete clouddabba-api 2>/dev/null || true
  run pm2 start ecosystem.config.js
  ROLLBACK_ACTIONS+=("pm2 delete clouddabba-api 2>/dev/null")

  run_quiet pm2 save
  pm2 startup 2>&1 | grep "sudo" | bash >> "$LOG_FILE" 2>&1 || true
  ok "PM2 running + auto-start on reboot"

  info "Health check..."
  sleep 3
  for i in $(seq 1 10); do
    if curl -sf http://localhost:6050/api/v1/health > /dev/null 2>&1; then
      ok "${G}Health check passed!${N}"
      return
    fi
    echo -ne "\r  ${D}│  ⏳ Starting... ($i/10)${N}   "
    sleep 2
  done
  echo ""
  wrn "Server still starting — check: pm2 logs clouddabba-api"
}

print_summary() {
  local URL
  if [ "$DOMAIN" = "$SERVER_IP" ]; then
    URL="http://${SERVER_IP}:6050"
  else
    URL="https://${DOMAIN}"
  fi

  local e=$(( $(date +%s) - T0 ))

  echo ""
  echo ""
  echo -e "  ${G}${BLD}╔═════════════════════════════════════════════╗${N}"
  echo -e "  ${G}${BLD}║     ✓  CloudDabba Installed Successfully    ║${N}"
  echo -e "  ${G}${BLD}╚═════════════════════════════════════════════╝${N}"
  echo ""
  echo -e "  ${W}Platform${N}     ${C}${URL}${N}"
  echo -e "  ${W}Setup${N}        ${C}${URL}/setup${N}"
  echo -e "  ${W}Admin${N}        ${ADMIN_EMAIL}"
  echo -e "  ${W}Time${N}         $((e/60))m $((e%60))s"
  echo ""
  echo -e "  ${Y}→ Open the Setup URL in browser to finish configuration${N}"
  echo ""
  echo -e "  ${D}Logs: $LOG_FILE | pm2 logs clouddabba-api${N}"
  echo ""
}

# ============================================
# MAIN
# ============================================
main() {
  echo "" > "$LOG_FILE"
  T0=$(date +%s)
  banner

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

  step "Configuring MariaDB"
  configure_mariadb

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
