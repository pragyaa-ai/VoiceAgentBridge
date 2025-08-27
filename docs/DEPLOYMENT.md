# 🚀 VoiceAgent Bridge - Deployment Guide

## 📋 Pre-Deployment Checklist

✅ **SingleInterface 2.0 VoiceAgent** running on target server  
✅ **LiveKit Cloud** account configured  
✅ **SIP Trunk** configured in LiveKit  
✅ **GCP VM** ready (Ubuntu 20.04+, 2+ vCPUs, 4GB+ RAM)  

## 🎯 Deployment Steps

### 1. Prepare Local Project

```bash
# Ensure project builds successfully
cd voiceagent-bridge
npm install
npm run build

# Test configuration
cp config/production.env .env
# Edit .env with your specific values
```

### 2. Copy to GCP VM

```bash
# Copy project to server
scp -r voiceagent-bridge/ user@your-vm-ip:/opt/

# Or using gcloud
gcloud compute scp --recurse voiceagent-bridge/ \
  your-vm-name:/opt/ --zone=your-zone
```

### 3. Server Setup

```bash
# SSH to server
gcloud compute ssh your-vm-name --zone=your-zone

# Run automated setup
cd /opt/voiceagent-bridge
chmod +x deploy/gcp-setup.sh
./deploy/gcp-setup.sh
```

### 4. Configure Environment

```bash
# Edit configuration for your environment
nano /opt/voiceagent-bridge/.env

# Key settings to update:
# SI2_ENDPOINT=ws://localhost:3001  # Your SI2 endpoint
# LIVEKIT_URL=wss://your-instance.livekit.cloud
# LIVEKIT_API_KEY=your_key
# LIVEKIT_API_SECRET=your_secret
```

### 5. Configure LiveKit Dispatch

```bash
# Install LiveKit CLI
npm install -g @livekit/cli

# Configure dispatch rules
livekit-cli sip dispatch create \
  --config /opt/voiceagent-bridge/config/dispatch-rules.json
```

### 6. Start Bridge Service

```bash
# Start with PM2
cd /opt/voiceagent-bridge
pm2 start deploy/pm2-config.js

# Enable auto-start
pm2 save
pm2 startup systemd
```

## ✅ Verification

### Check Bridge Status
```bash
pm2 status voiceagent-bridge
pm2 logs voiceagent-bridge --lines 20
```

### Test SIP Connection
```bash
# Make test call to your SIP number
# Should see logs showing:
# - Bridge session creation
# - SI2 connection established
# - Agent handoffs working
```

### Monitor Performance
```bash
# Real-time monitoring
pm2 monit

# System resources
htop
free -h
df -h
```

## 🔧 Production Configuration

### PM2 Configuration
```javascript
// deploy/pm2-config.js
module.exports = {
  apps: [{
    name: 'voiceagent-bridge',
    instances: 1,                    // Scale as needed
    max_memory_restart: '1G',        // Restart if memory exceeds 1GB
    autorestart: true,
    restart_delay: 4000,
    max_restarts: 10
  }]
}
```

### Log Rotation
```bash
# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Firewall Configuration
```bash
# If using external firewall
sudo ufw allow 50000:60000/tcp comment "VoiceAgent Bridge"

# For GCP firewall
gcloud compute firewall-rules create allow-voiceagent-bridge \
  --allow tcp:50000-60000 \
  --source-ranges 0.0.0.0/0 \
  --target-tags voiceagent-bridge
```

## 📊 Monitoring & Alerts

### Health Checks
```bash
# Create health check endpoint
curl http://localhost:50000/health

# Expected response:
{
  "status": "healthy",
  "bridge": "running",
  "si2_connection": "connected",
  "active_sessions": 0
}
```

### Log Monitoring
```bash
# Monitor error logs
tail -f /opt/voiceagent-bridge/logs/bridge-error.log

# Monitor session logs
pm2 logs voiceagent-bridge | grep "Session"
```

### Performance Metrics
```bash
# Session statistics
curl http://localhost:50000/stats

# System metrics
pm2 show voiceagent-bridge
```

## 🔄 Updates & Maintenance

### Updating Bridge
```bash
# Stop service
pm2 stop voiceagent-bridge

# Update code
cd /opt/voiceagent-bridge
git pull origin main
npm install
npm run build

# Restart service
pm2 restart voiceagent-bridge
```

### Backup Configuration
```bash
# Backup critical files
tar -czf voiceagent-bridge-backup.tar.gz \
  /opt/voiceagent-bridge/.env \
  /opt/voiceagent-bridge/config/ \
  /opt/voiceagent-bridge/logs/
```

### Database Maintenance
```bash
# Clean up old session data (if implemented)
# This would be application-specific
```

## 🚨 Troubleshooting

### Bridge Won't Start
```bash
# Check configuration
cat /opt/voiceagent-bridge/.env

# Check dependencies
cd /opt/voiceagent-bridge
npm list --depth=0

# Check build
npm run build
```

### Can't Connect to SingleInterface 2.0
```bash
# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  ws://localhost:3001/

# Check SI2 logs
# (Application-specific)
```

### LiveKit Issues
```bash
# Test LiveKit connection
livekit-cli token create \
  --api-key $LIVEKIT_API_KEY \
  --api-secret $LIVEKIT_API_SECRET

# Check dispatch rules
livekit-cli sip dispatch list
```

### Performance Issues
```bash
# Check system resources
htop
iotop
netstat -tulpn

# Check bridge metrics
curl http://localhost:50000/stats
```

## 📞 Support

### Log Collection
```bash
# Collect diagnostic information
mkdir -p bridge-diagnostics
cp /opt/voiceagent-bridge/.env bridge-diagnostics/
cp -r /opt/voiceagent-bridge/logs/ bridge-diagnostics/
pm2 describe voiceagent-bridge > bridge-diagnostics/pm2-status.txt
tar -czf bridge-diagnostics.tar.gz bridge-diagnostics/
```

### Contact Information
- GitHub Issues: [Repository Issues](https://github.com/your-org/voiceagent-bridge/issues)
- Documentation: [Bridge Architecture](../voiceagent-lk1/TELEPHONY_BRIDGE_ARCHITECTURE.md)

---

**Last Updated**: 2025-01-27  
**Version**: 1.0.0
