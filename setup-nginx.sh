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

# Set domain and port based on environment
if [ "$ENV" = "prod" ]; then
    DOMAIN="agent.thaink2.fr"
    PORT="3001"
    echo -e "${BLUE}🌐 Configuring Nginx for PRODUCTION: $DOMAIN...${NC}"
else
    DOMAIN="agent-dev.thaink2.fr"
    PORT="3000"
    echo -e "${BLUE}🌐 Configuring Nginx for DEV: $DOMAIN...${NC}"
fi

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}📦 Nginx not found, installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y nginx
    echo -e "${GREEN}✅ Nginx installed${NC}"
fi

# Create nginx configuration
echo -e "${YELLOW}📝 Creating Nginx configuration...${NC}"
sudo tee $NGINX_CONF > /dev/null <<EOF
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

echo -e "${GREEN}✅ Nginx configuration created${NC}"

# Enable site
if [ ! -L "$NGINX_ENABLED" ]; then
    echo -e "${YELLOW}🔗 Enabling site...${NC}"
    sudo ln -s $NGINX_CONF $NGINX_ENABLED
    echo -e "${GREEN}✅ Site enabled${NC}"
fi

# Test nginx configuration
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
sudo nginx -t

# Reload nginx
echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
sudo systemctl reload nginx

echo -e "${GREEN}✅ Nginx configured successfully!${NC}"
echo -e "${BLUE}📡 Domain: http://$DOMAIN${NC}"