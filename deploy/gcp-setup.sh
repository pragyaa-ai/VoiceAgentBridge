#!/bin/bash

# VoiceAgent Bridge - GCP VM Setup Script
# This script sets up the bridge on a GCP VM alongside SingleInterface 2.0

set -e

echo "🚀 VoiceAgent Bridge - GCP Setup Starting..."

# Configuration
BRIDGE_DIR="/opt/voiceagent-bridge"
NODE_VERSION="18"
USER="voiceagent"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Run as a regular user with sudo privileges."
   exit 1
fi

print_status "Step 1: System Update"
sudo apt-get update && sudo apt-get upgrade -y

print_status "Step 2: Install Node.js ${NODE_VERSION}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

print_status "Step 3: Install Build Tools"
sudo apt-get install -y build-essential git htop curl wget

print_status "Step 4: Install PM2 Process Manager"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    pm2 install pm2-logrotate
else
    print_status "PM2 already installed: $(pm2 --version)"
fi

print_status "Step 5: Create Bridge Directory"
sudo mkdir -p $BRIDGE_DIR
sudo chown -R $USER:$USER $BRIDGE_DIR

print_status "Step 6: Clone/Copy Bridge Project"
if [ -d "$BRIDGE_DIR/.git" ]; then
    print_status "Bridge project exists, pulling latest changes..."
    cd $BRIDGE_DIR
    git pull
else
    print_status "Cloning bridge project..."
    # For now, copy from local development
    # In production, this would be: git clone <bridge-repo-url> $BRIDGE_DIR
    echo "Please copy your bridge project to $BRIDGE_DIR"
    echo "Run: scp -r voiceagent-bridge/* user@vm:$BRIDGE_DIR/"
fi

# If project files exist, continue with setup
if [ -f "$BRIDGE_DIR/package.json" ]; then
    print_status "Step 7: Install Dependencies"
    cd $BRIDGE_DIR
    npm install --production

    print_status "Step 8: Build Project"
    npm run build

    print_status "Step 9: Create Logs Directory"
    mkdir -p $BRIDGE_DIR/logs

    print_status "Step 10: Configure Environment"
    if [ ! -f "$BRIDGE_DIR/.env" ]; then
        cp $BRIDGE_DIR/config/production.env $BRIDGE_DIR/.env
        print_warning "Please edit $BRIDGE_DIR/.env with your specific configuration"
    fi

    print_status "Step 11: Configure PM2"
    pm2 delete voiceagent-bridge 2>/dev/null || true
    pm2 start $BRIDGE_DIR/deploy/pm2-config.js

    print_status "Step 12: Save PM2 Configuration"
    pm2 save
    pm2 startup systemd -u $USER --hp /home/$USER

    print_status "Step 13: Configure Firewall (if needed)"
    # sudo ufw allow 50000:60000/tcp comment "VoiceAgent Bridge"

    print_status "Step 14: Setup Log Rotation"
    pm2 set pm2-logrotate:max_size 100M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true

    print_status "✅ Bridge Setup Complete!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Edit configuration: nano $BRIDGE_DIR/.env"
    echo "2. Update SI2_ENDPOINT to point to your SingleInterface 2.0 instance"
    echo "3. Configure LiveKit dispatch rules with: livekit-cli sip dispatch create --config $BRIDGE_DIR/config/dispatch-rules.json"
    echo "4. Test the bridge: pm2 logs voiceagent-bridge"
    echo "5. Make a test call to verify connectivity"
    echo ""
    echo "📊 Management Commands:"
    echo "- View logs: pm2 logs voiceagent-bridge"
    echo "- Restart: pm2 restart voiceagent-bridge"
    echo "- Status: pm2 status"
    echo "- Monitor: pm2 monit"
    echo ""
else
    print_error "Bridge project not found in $BRIDGE_DIR"
    print_error "Please copy the bridge project files and run this script again"
    exit 1
fi

print_status "🎉 VoiceAgent Bridge deployment complete!"



