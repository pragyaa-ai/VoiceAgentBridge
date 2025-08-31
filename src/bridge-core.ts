import dotenv from 'dotenv';
import { SI2Connector } from './connectors/si2-connector.js';
import { SessionManager } from './utils/session-manager.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config({ path: './config/production.env' });

export class VoiceAgentBridge {
  private si2Connector: SI2Connector;
  private sessionManager: SessionManager;
  private isRunning = false;

  constructor() {
    const si2Endpoint = process.env.SI2_ENDPOINT || 'ws://localhost:3000';
    this.si2Connector = new SI2Connector(si2Endpoint);
    this.sessionManager = new SessionManager();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.si2Connector.on('connected', () => {
      logger.info('Bridge connected to SingleInterface 2.0');
    });

    this.si2Connector.on('disconnected', () => {
      logger.warn('Bridge disconnected from SingleInterface 2.0');
    });

    this.si2Connector.on('error', (error) => {
      logger.error('SI2 connection error:', error);
    });

    this.si2Connector.on('audio', (audioData) => {
      logger.debug('Received audio from SI2');
      // TODO: Forward to LiveKit when implemented
    });

    this.si2Connector.on('text', (textData) => {
      logger.info('Received text from SI2:', textData);
    });

    this.si2Connector.on('handoff', (handoffData) => {
      logger.info('Agent handoff:', handoffData);
    });

    this.si2Connector.on('session_end', () => {
      logger.info('SI2 session ended');
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge is already running');
      return;
    }

    try {
      logger.info('Starting VoiceAgent Bridge...');
      
      // Connect to SingleInterface 2.0
      await this.si2Connector.connect();
      
      this.isRunning = true;
      logger.info('VoiceAgent Bridge started successfully');
      
      // Keep the process running
      this.keepAlive();
      
    } catch (error) {
      logger.error('Failed to start bridge:', error);
      throw error;
    }
  }

  private keepAlive(): void {
    // Log status every 30 seconds
    setInterval(() => {
      const activeSessions = this.sessionManager.getActiveSessions();
      logger.info(`Bridge status: ${activeSessions.length} active sessions`);
    }, 30000);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping VoiceAgent Bridge...');
    
    this.si2Connector.disconnect();
    this.isRunning = false;
    
    logger.info('VoiceAgent Bridge stopped');
  }
}

// Main execution
async function main() {
  const bridge = new VoiceAgentBridge();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bridge.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await bridge.stop();
    process.exit(0);
  });

  try {
    await bridge.start();
  } catch (error) {
    logger.error('Failed to start bridge:', error);
    process.exit(1);
  }
}

// Start the bridge if this file is run directly
// In ES modules, we can't use require.main === module, so we always start
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});