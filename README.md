# 🌉 VoiceAgent Bridge

Universal communication bridge for connecting multiple protocols to SingleInterface 2.0 VoiceAgent.

## 📋 Overview

VoiceAgent Bridge is a production-ready communication bridge that connects your existing **SingleInterface 2.0 VoiceAgent** to multiple communication protocols without requiring changes to your proven agent logic.

### 🎯 Key Features

- **🔗 Universal Protocol Support**: SIP Telephony, WebRTC, WebSocket
- **🤖 SingleInterface 2.0 Integration**: Seamless connection to your existing multi-agent system
- **📊 Data Collection**: Preserves agent handoffs and data collection capabilities
- **🚀 Production Ready**: Built for GCP deployment with monitoring and logging
- **📈 Scalable Architecture**: Add new protocols without touching existing code

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION BRIDGE                        │
├─────────────────────────────────────────────────────────────────┤
│  SIP Telephony  │  WebRTC API  │  WebSocket API  │  Future APIs │
│  (Twilio)       │  (Direct)    │  (Chat/Voice)   │  (WhatsApp)  │
└─────────────────┬───────────────┬─────────────────┬─────────────┘
                  │               │                 │
                  ▼               ▼                 ▼
              ┌─────────────────────────────────────────┐
              │         UNIFIED BRIDGE CORE             │
              │  • Audio/Text Normalization             │
              │  • Protocol Translation                 │
              │  • Session Management                   │
              │  • Error Handling                       │
              └─────────────────┬───────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────────────────┐
              │      SingleInterface 2.0 VoiceAgent     │
              │  Authentication → Spotlight → Car Dealer │
              │  • Multi-agent handoffs                 │
              │  • Data collection                      │
              │  • Business logic                       │
              └─────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- SingleInterface 2.0 VoiceAgent running
- LiveKit Cloud account
- GCP VM (recommended for production)

### 1. Installation

```bash
# Clone the project
git clone <repository-url>
cd voiceagent-bridge

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configuration

```bash
# Copy environment configuration
cp config/production.env .env

# Edit configuration
nano .env
```

**Required Environment Variables:**
```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
SIP_TRUNK_ID=your_sip_trunk_id

# SingleInterface 2.0 Configuration
SI2_ENDPOINT=ws://localhost:3001  # Update to your SI2 endpoint

# Bridge Configuration
LOG_LEVEL=info
NODE_ENV=production
```

### 3. Deploy LiveKit Dispatch Rules

```bash
# Configure LiveKit to route calls to the bridge
livekit-cli sip dispatch create --config config/dispatch-rules.json
```

### 4. Start the Bridge

```bash
# Development
npm run dev

# Production (with PM2)
pm2 start deploy/pm2-config.js
```

## 🛠️ Project Structure

```
voiceagent-bridge/
├── src/
│   ├── bridge-core.ts           # Main entry point
│   ├── adapters/
│   │   ├── sip-adapter.ts       # SIP telephony handler
│   │   ├── webrtc-adapter.ts    # WebRTC direct calls (future)
│   │   └── websocket-adapter.ts # WebSocket chat/voice (future)
│   ├── connectors/
│   │   └── si2-connector.ts     # SingleInterface 2.0 WebSocket connector
│   └── utils/
│       ├── audio-pipeline.ts    # Audio format conversion
│       ├── session-manager.ts   # Session tracking & data collection
│       └── logger.ts            # Structured logging
├── config/
│   ├── production.env           # Production configuration
│   └── dispatch-rules.json      # LiveKit routing rules
├── deploy/
│   ├── gcp-setup.sh            # GCP deployment script
│   └── pm2-config.js           # Process management
└── docs/
    ├── DEPLOYMENT.md            # Deployment guide
    └── API.md                   # Bridge API documentation
```

## 🔧 Protocol Adapters

### Current Support

#### 📞 SIP Adapter (Production Ready)
- **Purpose**: Connect Twilio SIP trunks to SingleInterface 2.0
- **Features**: Audio bridging, session management, error handling
- **Status**: ✅ Implemented and tested

### Future Support

#### 🌐 WebRTC Adapter (Planned)
- **Purpose**: Direct browser-to-agent calls
- **Features**: Video calling, screen sharing, no phone required
- **Status**: 🔄 Architecture designed

#### 💬 WebSocket Adapter (Planned)
- **Purpose**: Chat and voice over WebSocket
- **Features**: Text chat with voice responses, mobile app integration
- **Status**: 🔄 Architecture designed

## 📊 Session Management

The bridge tracks and manages sessions with comprehensive data collection:

### Session Data
- **Agent handoffs**: Authentication → Spotlight → Car Dealer
- **Data collection**: All data points captured by agents
- **Audio metrics**: Latency, quality, processing statistics
- **Error tracking**: Connection issues, processing errors

### Monitoring
```bash
# View session statistics
curl http://localhost:50000/stats

# Real-time logs
pm2 logs voiceagent-bridge

# System monitoring
pm2 monit
```

## 🚀 GCP Deployment

### Automated Setup

```bash
# Run the automated setup script
chmod +x deploy/gcp-setup.sh
./deploy/gcp-setup.sh
```

### Manual Steps

1. **Create GCP VM**:
   ```bash
   gcloud compute instances create voiceagent-bridge \
     --zone=us-central1-a \
     --machine-type=e2-medium \
     --image-family=ubuntu-2004-lts \
     --image-project=ubuntu-os-cloud
   ```

2. **Copy project files**:
   ```bash
   scp -r voiceagent-bridge/* user@vm:/opt/voiceagent-bridge/
   ```

3. **SSH and complete setup**:
   ```bash
   gcloud compute ssh voiceagent-bridge
   cd /opt/voiceagent-bridge
   ./deploy/gcp-setup.sh
   ```

## 🔍 Testing

### Test SIP Connection
```bash
# Check bridge status
pm2 status voiceagent-bridge

# View real-time logs
pm2 logs voiceagent-bridge --lines 50

# Test call to your SIP number
# Should show bridge session creation and SI2 connection
```

### Expected Log Flow
```
🌉 Starting VoiceAgent Bridge session
📞 Room: bridge-call-_+1234567890_xyz
👤 Participant connected: +1234567890
🔗 Connected to SingleInterface 2.0
🚀 Bridge session started successfully
🔄 Agent handoff: authentication → spotlight
📊 Data collected: customer_intent = car_purchase
🔄 Agent handoff: spotlight → carDealer
🏁 Session ended by SingleInterface 2.0
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Multiple bridge instances
pm2 scale voiceagent-bridge 3

# Load balancer configuration
# Route calls across multiple bridge instances
```

### Protocol Expansion
```javascript
// Add new protocol adapter
class WhatsAppAdapter implements CommunicationAdapter {
  // Implement WhatsApp Business API integration
}
```

## 🛡️ Production Considerations

### Security
- ✅ Encrypted WebSocket connections to SI2
- ✅ Secure LiveKit API credentials
- ✅ Environment variable protection
- ⚠️ Firewall configuration for production

### Monitoring
- ✅ Structured logging with Pino
- ✅ PM2 process monitoring
- ✅ Session statistics tracking
- ⚠️ External monitoring integration needed

### Backup & Recovery
- ✅ Automatic restart on failures
- ✅ Session data persistence
- ⚠️ Database backup strategy needed

## 🐛 Troubleshooting

### Common Issues

#### Bridge Won't Start
```bash
# Check environment variables
cat .env

# Verify dependencies
npm list --depth=0

# Check logs
pm2 logs voiceagent-bridge --err
```

#### Can't Connect to SingleInterface 2.0
```bash
# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3001/
```

#### LiveKit Connection Issues
```bash
# Verify LiveKit credentials
livekit-cli token create --api-key $LIVEKIT_API_KEY \
  --api-secret $LIVEKIT_API_SECRET

# Check dispatch rules
livekit-cli sip dispatch list
```

#### Audio Quality Issues
```bash
# Monitor audio pipeline
pm2 logs voiceagent-bridge | grep "Audio"

# Check system resources
htop
free -h
```

## 📚 API Documentation

### Bridge Management API

#### Health Check
```bash
GET /health
# Returns bridge status and connectivity
```

#### Session Statistics
```bash
GET /stats
# Returns session metrics and performance data
```

#### Active Sessions
```bash
GET /sessions
# Returns list of active bridge sessions
```

## 🤝 Contributing

### Development Setup
```bash
# Install development dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run type-check
```

### Adding New Protocol Adapters
1. Create adapter class implementing `CommunicationAdapter`
2. Add to bridge-core.ts routing logic
3. Update configuration and documentation
4. Add tests and deployment scripts

## 📄 License

MIT License - see LICENSE file for details.

## 🙋‍♂️ Support

### Documentation
- [Architecture Document](../voiceagent-lk1/TELEPHONY_BRIDGE_ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API.md)

### Issues
- Create GitHub issues for bugs and feature requests
- Check existing issues before creating new ones
- Provide logs and environment details

---

**Version**: 1.0.0  
**Status**: Production Ready (SIP), Architecture Ready (WebRTC, WebSocket)  
**Last Updated**: 2025-01-27  

🚀 **Ready to bridge your SingleInterface 2.0 to the world!**