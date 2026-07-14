#!/bin/bash
set -euo pipefail

# TaskEasy VPS Setup Script for Hostinger (Ubuntu 24.04 + CloudPanel)
# Run as root: bash setup-vps.sh

echo "=== TaskEasy VPS Setup ==="

# ─── 1. Install Docker if not present ───────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed."
else
    echo "Docker already installed."
fi

# ─── 2. Install Docker Compose plugin if not present ────────────────────────
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "Docker Compose plugin installed."
else
    echo "Docker Compose already available."
fi

# ─── 3. Create app directory ────────────────────────────────────────────────
APP_DIR="/home/taskeasy"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  cd $APP_DIR && git clone <your-repo-url> app"
echo "  2. Create env file:  cp app/.env.production.example app/.env.production"
echo "  3. Edit env file:    nano app/.env.production  (fill in real passwords/secrets)"
echo "  4. Build & start:    cd app && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build"
echo "  5. Add site in CloudPanel, then copy Nginx config:"
echo "     cp app/deploy/nginx-taskeasy.conf /etc/nginx/sites-enabled/yourdomain.com.conf"
echo "     nginx -t && systemctl reload nginx"
echo ""
