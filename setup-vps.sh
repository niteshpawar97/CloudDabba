#!/bin/bash
# =========================================
# CloudDabba - VPS Setup (No sudo required)
# =========================================
# Usage: cd ~/htdocs/clouddabba && chmod +x setup-vps.sh && ./setup-vps.sh

set -e

INSTALL_DIR="/home/learn-nodejs/htdocs/clouddabba"

echo ""
echo "========================================="
echo "  CloudDabba - Setup"
echo "========================================="
echo ""

# Check if required tools are installed
echo "Checking dependencies..."
command -v node &>/dev/null && echo "  Node.js: $(node -v)" || { echo "  ERROR: Node.js not found. Ask admin to install."; exit 1; }
command -v npm &>/dev/null && echo "  npm: $(npm -v)" || { echo "  ERROR: npm not found."; exit 1; }
command -v git &>/dev/null && echo "  Git: $(git --version)" || { echo "  ERROR: Git not found."; exit 1; }
command -v docker &>/dev/null && echo "  Docker: $(docker --version)" || echo "  WARNING: Docker not found. Deployments won't work."

# Install PM2 locally if not available
if ! command -v pm2 &>/dev/null; then
    echo "  Installing PM2..."
    npm install -g pm2 2>/dev/null || npm install pm2
fi

# --- Backend Setup ---
echo ""
echo "[1/4] Setting up Backend..."
cd $INSTALL_DIR/backend

if [ ! -f .env ]; then
    cp $INSTALL_DIR/.env.production .env
    echo ""
    echo "  ============================================"
    echo "  IMPORTANT: Edit .env with your DB credentials!"
    echo "  nano $INSTALL_DIR/backend/.env"
    echo "  Then run this script again."
    echo "  ============================================"
    echo ""
    exit 0
fi

npm install
npx prisma generate
npx prisma db push
npx prisma db seed 2>/dev/null || echo "  Seed already exists, skipping."
npm run build
echo "  Backend ready."

# --- Frontend Setup ---
echo ""
echo "[2/4] Setting up Frontend..."
cd $INSTALL_DIR/frontend
npm install
npm run build
echo "  Frontend built."

# --- Start with PM2 ---
echo ""
echo "[3/4] Starting CloudDabba..."
cd $INSTALL_DIR
pm2 delete clouddabba-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo "  API started."

# --- NGINX ---
echo ""
echo "[4/4] NGINX config..."
echo "  Ask your admin to copy NGINX config:"
echo "  sudo cp $INSTALL_DIR/nginx/production.conf /etc/nginx/nginx.conf"
echo "  sudo nginx -t && sudo systemctl reload nginx"

echo ""
echo "========================================="
echo "  CloudDabba Setup Complete!"
echo "========================================="
echo ""
echo "  API:    http://clouddabba.dev/api/v1/health"
echo "  Panel:  http://clouddabba.dev"
echo ""
echo "  Demo Login:"
echo "    Email:    demo@clouddabba.com"
echo "    Password: demo1234"
echo ""
echo "  PM2 Commands:"
echo "    pm2 logs clouddabba-api"
echo "    pm2 status"
echo "    pm2 restart clouddabba-api"
echo ""
echo "========================================="
