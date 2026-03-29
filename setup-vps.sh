#!/bin/bash
# CloudDabba VPS Setup Script
# Run on Ubuntu 22.04 VPS: curl -sSL <url> | bash
# OR copy this file to VPS and run: chmod +x setup-vps.sh && ./setup-vps.sh

set -e

echo "========================================="
echo "  CloudDabba VPS Setup"
echo "  Target: Ubuntu 22.04"
echo "========================================="

# --- 1. System Update ---
echo "[1/8] Updating system..."
sudo apt update && sudo apt upgrade -y

# --- 2. Install Docker ---
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "Docker installed."
else
    echo "Docker already installed."
fi

# --- 3. Install Docker Compose ---
echo "[3/8] Installing Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    sudo apt install -y docker-compose-plugin
    echo "Docker Compose installed."
else
    echo "Docker Compose already installed."
fi

# --- 4. Install Node.js 22 ---
echo "[4/8] Installing Node.js 22..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "Node.js $(node -v) installed."
else
    echo "Node.js $(node -v) already installed."
fi

# --- 5. Install NGINX ---
echo "[5/8] Installing NGINX..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    echo "NGINX installed."
else
    echo "NGINX already installed."
fi

# --- 6. Install Git ---
echo "[6/8] Installing Git..."
sudo apt install -y git

# --- 7. Install PM2 (Process Manager) ---
echo "[7/8] Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "PM2 installed."
else
    echo "PM2 already installed."
fi

# --- 8. Setup CloudDabba directories ---
echo "[8/8] Setting up CloudDabba..."
INSTALL_DIR="/opt/clouddabba"
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR

echo ""
echo "========================================="
echo "  VPS Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Copy project to VPS:"
echo "     scp -r ./backend ./frontend ubuntu@129.159.16.65:/opt/clouddabba/"
echo ""
echo "  2. SSH into VPS:"
echo "     ssh ubuntu@129.159.16.65"
echo ""
echo "  3. Setup backend:"
echo "     cd /opt/clouddabba/backend"
echo "     npm install"
echo "     npx prisma generate"
echo "     npx prisma db push"
echo "     npx prisma db seed"
echo ""
echo "  4. Setup frontend:"
echo "     cd /opt/clouddabba/frontend"
echo "     npm install"
echo "     npm run build"
echo ""
echo "  5. Start with PM2:"
echo "     cd /opt/clouddabba/backend"
echo "     pm2 start npm --name clouddabba-api -- run start"
echo ""
echo "  6. Serve frontend via NGINX (static build)"
echo ""
echo "  7. Setup NGINX config:"
echo "     sudo cp /opt/clouddabba/nginx/nginx.conf /etc/nginx/nginx.conf"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "========================================="
