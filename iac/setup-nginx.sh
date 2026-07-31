#!/bin/bash
# iac/setup-nginx.sh — parametrized via .env (falls back to legacy CLI arg)
#
# Reads from .env / environment before applying defaults:
#   DOMAIN  default: agent.thaink2.fr (prod) / agent-dev.thaink2.fr (dev)
#   PORT    default: 3001 (prod) / 3000 (dev)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

ENV_ARG="${1:-}"
ENV="${ENV_ARG:-${ENVIRONMENT:-dev}}"
case "$ENV" in
    production) ENV=prod ;;
    development) ENV=dev ;;
esac

if [ -z "${DOMAIN:-}" ]; then
    if [ "$ENV" = "prod" ]; then
        DOMAIN="agent.thaink2.fr"
    else
        DOMAIN="agent-dev.thaink2.fr"
    fi
fi
if [ -z "${PORT:-}" ]; then
    if [ "$ENV" = "prod" ]; then PORT=3001; else PORT=3000; fi
fi

echo -e "${BLUE}🌐 Configuring Nginx — DOMAIN=${DOMAIN}, PORT=${PORT}${NC}"

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}📦 Installing nginx...${NC}"
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Backup existing
[ -f "$NGINX_CONF" ] && sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d-%H%M%S)"

sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

[ ! -L "$NGINX_ENABLED" ] && sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"

sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✅ Nginx configured for ${DOMAIN}:${PORT}${NC}"
