#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Environment parameter (default: dev)
ENV=${1:-dev}

# Set port based on environment
if [ "$ENV" = "prod" ]; then
    PORT="3001"
    APP_NAME="th2agent-app-prod"
    echo -e "${BLUE}🚀 Starting th2agent-app deployment for PRODUCTION (port $PORT)...${NC}"
else
    PORT="3000"
    APP_NAME="th2agent-app-dev"
    echo -e "${BLUE}🚀 Starting th2agent-app deployment for DEV (port $PORT)...${NC}"
fi

PROJECT_DIR=/home/ubuntu/thaink2/th2agent-app
cd $PROJECT_DIR

# Check and install Node.js if not exists
# Check and install Node.js if not exists or upgrade to v20
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Node.js not found, installing v20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js installed${NC}"
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        echo -e "${YELLOW}⚠️  Node.js v$NODE_VERSION detected, upgrading to v20...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        echo -e "${GREEN}✅ Node.js upgraded to $(node -v)${NC}"
    else
        echo -e "${GREEN}✅ Node.js $(node -v) already installed${NC}"
    fi
fi

# Install dependencies
echo -e "${YELLOW}📥 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build the project
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build
echo -e "${GREEN}✅ Project built successfully${NC}"

# Install PM2 if not exists
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 PM2 not found, installing...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 already installed${NC}"
fi

# Stop existing PM2 process if running
echo -e "${YELLOW}🛑 Stopping existing process...${NC}"
pm2 delete $APP_NAME 2>/dev/null || true
echo -e "${GREEN}✅ Existing process stopped${NC}"

# Start the app with PM2
echo -e "${YELLOW}🚀 Starting application with PM2 on port $PORT...${NC}"
pm2 start npm --name "$APP_NAME" -- start -- --port $PORT
pm2 save

# Setup PM2 startup (run only if not already configured)
if ! sudo systemctl is-enabled pm2-$USER &> /dev/null; then
    echo -e "${YELLOW}⏰ Setting up PM2 startup...${NC}"
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
    pm2 save
    echo -e "${GREEN}✅ PM2 startup configured${NC}"
else
    echo -e "${GREEN}✅ PM2 startup already configured${NC}"
fi

# Wait for app to be healthy
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
MAX_ATTEMPTS=4
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    if curl -f http://localhost:$PORT 2>/dev/null; then
        echo -e "${GREEN}✅ Application is up and running on port $PORT!${NC}"
        echo -e "${GREEN}📊 PM2 status:${NC}"
        pm2 status
        exit 0
    fi
    
    echo -e "${YELLOW}⏳ Attempt $ATTEMPT/$MAX_ATTEMPTS: Application not ready yet...${NC}"
    sleep 5
done

# If we get here, deployment failed
echo -e "${RED}❌ Application failed to start after $MAX_ATTEMPTS attempts${NC}"
echo -e "${RED}📋 Showing PM2 logs:${NC}"
pm2 logs $APP_NAME --lines 50 --nostream
exit 1