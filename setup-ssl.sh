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

# Set domain based on environment
if [ "$ENV" = "prod" ]; then
    DOMAIN="agent.thaink2.fr"
    echo -e "${BLUE}🔒 Setting up SSL certificate for PRODUCTION: $DOMAIN...${NC}"
else
    DOMAIN="agent-dev.thaink2.fr"
    echo -e "${BLUE}🔒 Setting up SSL certificate for DEV: $DOMAIN...${NC}"
fi

EMAIL="farid.azouaou@thaink2.fr"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}📦 Certbot not found, installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✅ Certbot installed${NC}"
else
    echo -e "${GREEN}✅ Certbot already installed${NC}"
fi

# Check if certificate exists for this specific domain
if sudo certbot certificates 2>/dev/null | grep -A 2 "Certificate Name: $DOMAIN" | grep -q "Domains: $DOMAIN"; then
    echo -e "${YELLOW}📜 Certificate already exists for $DOMAIN${NC}"
    echo -e "${YELLOW}🔄 Renewing certificate...${NC}"
    sudo certbot renew --cert-name $DOMAIN --nginx --non-interactive
    echo -e "${GREEN}✅ Certificate renewed${NC}"
else
    echo -e "${YELLOW}📜 Certificate not found for $DOMAIN${NC}"
    echo -e "${YELLOW}🆕 Obtaining new SSL certificate...${NC}"
    sudo certbot --nginx \
        -d $DOMAIN \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        --redirect
    echo -e "${GREEN}✅ SSL certificate obtained and installed${NC}"
fi

# Test nginx configuration
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
sudo nginx -t

# Reload nginx
echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
sudo systemctl reload nginx

# Setup auto-renewal
if ! sudo systemctl is-enabled certbot.timer &> /dev/null; then
    echo -e "${YELLOW}⏰ Enabling certbot auto-renewal...${NC}"
    sudo systemctl enable certbot.timer
    sudo systemctl start certbot.timer
    echo -e "${GREEN}✅ Auto-renewal enabled${NC}"
else
    echo -e "${GREEN}✅ Auto-renewal already enabled${NC}"
fi

echo -e "${GREEN}✅ SSL certificate configured successfully!${NC}"
echo -e "${BLUE}📡 Domain: https://$DOMAIN${NC}"
echo -e "${BLUE}🔒 Certificate expires in 90 days (auto-renews)${NC}"

# Show certificate info for this domain
echo -e "${YELLOW}📋 Certificate information:${NC}"
sudo certbot certificates | grep -A 10 "$DOMAIN" || echo "Certificate details not found"