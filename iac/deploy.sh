#!/bin/bash
# iac/deploy.sh — parametrized via .env (falls back to legacy CLI arg)
#
# Reads from .env (or environment) before applying CLI defaults:
#   PORT           default: 3000 (dev) / 3001 (prod)
#   APP_NAME       default: th2agent-app-${ENV}
#   PROJECT_DIR    default: cwd
# Arg ENV (prod|dev): used only when nothing is set in .env / env vars.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load .env if present (cwd)
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

# Resolve ENV from CLI arg, ENVIRONMENT env, else 'dev'
ENV_ARG="${1:-}"
ENV="${ENV_ARG:-${ENVIRONMENT:-dev}}"
case "$ENV" in
    production) ENV=prod ;;
    development) ENV=dev ;;
esac

# Defaults if .env / env did not provide
if [ -z "${PORT:-}" ]; then
    if [ "$ENV" = "prod" ]; then PORT=3001; else PORT=3000; fi
fi
APP_NAME="${APP_NAME:-th2agent-app-${ENV}}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

echo -e "${BLUE}🚀 th2agent-app deployment — ENV=${ENV}, PORT=${PORT}, APP_NAME=${APP_NAME}${NC}"
echo -e "${BLUE}   PROJECT_DIR=${PROJECT_DIR}${NC}"

cd "$PROJECT_DIR"

# Node.js >= 20
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Node.js not found, installing v20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
elif [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js < v20, upgrading...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

echo -e "${YELLOW}📥 Installing dependencies...${NC}"
npm install
echo -e "${YELLOW}🔨 Building...${NC}"
npm run build

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 PM2 not found, installing...${NC}"
    sudo npm install -g pm2
fi

echo -e "${YELLOW}🛑 Stopping existing process ${APP_NAME}...${NC}"
pm2 delete "$APP_NAME" 2>/dev/null || true

echo -e "${YELLOW}🚀 Starting ${APP_NAME} on port ${PORT}...${NC}"
pm2 start npm --name "$APP_NAME" -- start -- --port "$PORT"
pm2 save

if ! sudo systemctl is-enabled "pm2-$USER" &> /dev/null; then
    echo -e "${YELLOW}⏰ Setting up PM2 startup...${NC}"
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME"
    pm2 save
fi

echo -e "${YELLOW}⏳ Waiting for app to be healthy on http://localhost:${PORT} ...${NC}"
for i in 1 2 3 4 5 6 7 8; do
    if curl -fsS -o /dev/null "http://localhost:${PORT}"; then
        echo -e "${GREEN}✅ App is up on port ${PORT}${NC}"
        pm2 status
        exit 0
    fi
    echo -e "${YELLOW}   attempt ${i}/8 — not ready yet${NC}"
    sleep 5
done

echo -e "${RED}❌ App failed to start on port ${PORT}${NC}"
pm2 logs "$APP_NAME" --lines 60 --nostream || true
exit 1
