import dotenv from 'dotenv';
import { OpenAIRealtimeConnector } from './connectors/openai-realtime-connector.js';
import { SessionManager } from './utils/session-manager.js';
import { LMSService } from './services/lms-service.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config({ path: './config/production.env' });

export class VoiceAgentBridge {
  private realtimeConnector: OpenAIRealtimeConnector;
  private sessionManager: SessionManager;
  private lmsService: LMSService;
  private isRunning = false;

  constructor() {
    // Initialize services
    this.sessionManager = new SessionManager();
    this.lmsService = new LMSService();
    
    // Initialize OpenAI Realtime connector with Spotlight agent
    this.realtimeConnector = new OpenAIRealtimeConnector({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-realtime-preview-2025-06-03',
      audioFormat: 'pcm16',
      sessionManager: this.sessionManager
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.realtimeConnector.on('connected', () => {
      logger.info('Bridge connected to OpenAI Realtime API with Spotlight Agent');
    });

    this.realtimeConnector.on('disconnected', () => {
      logger.warn('Bridge disconnected from OpenAI Realtime API');
    });

    this.realtimeConnector.on('error', (error) => {
      logger.error('OpenAI Realtime connection error:', error);
    });

    this.realtimeConnector.on('data_captured', (data) => {
      logger.info('Sales data captured:', data);
    });

    this.realtimeConnector.on('data_verified', (data) => {
      logger.info('Sales data verified:', data);
    });

    this.realtimeConnector.on('lms_push', (data) => {
      logger.info('Sales data pushed to LMS:', data);
    });

    this.realtimeConnector.on('handoff', (handoffData) => {
      logger.info('Agent handoff requested:', handoffData);
      // TODO: Implement handoff to Car Dealer agent
    });

    this.realtimeConnector.on('transport_event', (event) => {
      logger.debug('OpenAI transport event:', event);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge is already running');
      return;
    }

    try {
      logger.info('Starting VoiceAgent Bridge with Spotlight Agent...');
      
      // Validate LMS connection
      const lmsConnected = await this.lmsService.validateLMSConnection();
      if (lmsConnected) {
        logger.info('LMS connection validated');
      } else {
        logger.warn('LMS connection failed - using dummy mode');
      }
      
      // Connect to OpenAI Realtime API
      await this.realtimeConnector.connect();
      
      this.isRunning = true;
      logger.info('VoiceAgent Bridge started successfully with Spotlight Agent');
      
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
    
    this.realtimeConnector.disconnect();
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