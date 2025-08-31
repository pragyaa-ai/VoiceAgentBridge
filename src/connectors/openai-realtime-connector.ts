import { EventEmitter } from 'events';
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { spotlightAgent } from '../agents/spotlight-agent.js';
import { LMSService, SalesData } from '../services/lms-service.js';
import { SessionManager } from '../utils/session-manager.js';
import logger from '../utils/logger.js';

export interface RealtimeConnectorConfig {
  apiKey: string;
  model?: string;
  audioFormat?: string;
  sessionManager: SessionManager;
}

export class OpenAIRealtimeConnector extends EventEmitter {
  private session: RealtimeSession | null = null;
  private config: RealtimeConnectorConfig;
  private lmsService: LMSService;
  private salesData: Partial<SalesData> = {};
  private isConnected = false;

  constructor(config: RealtimeConnectorConfig) {
    super();
    this.config = config;
    this.lmsService = new LMSService();
    this.setupAgentContext();
  }

  private setupAgentContext() {
    // Set up context functions that the Spotlight agent tools will call
    const context = {
      captureSalesData: this.captureSalesData.bind(this),
      verifySalesData: this.verifySalesData.bind(this),
      pushToLMS: this.pushToLMS.bind(this),
      disconnectSession: this.disconnectSession.bind(this)
    };

    // Store context for tool execution
    (globalThis as any).bridgeContext = context;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected to OpenAI Realtime API');
      return;
    }

    try {
      logger.info('Connecting to OpenAI Realtime API...');

      // Create Realtime session with Spotlight agent
      this.session = new RealtimeSession(spotlightAgent, {
        transport: new OpenAIRealtimeWebRTC({
          // Server-side audio handling will be implemented here
          changePeerConnection: async (pc: RTCPeerConnection) => {
            // Apply audio codec preferences if needed
            return pc;
          },
        }),
        model: this.config.model || 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioFormat: 'pcm16',
          outputAudioFormat: 'pcm16',
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        context: {
          preferredLanguage: 'English', // Default to English
          // Add context functions for agent tools
          captureSalesData: this.captureSalesData.bind(this),
          verifySalesData: this.verifySalesData.bind(this),
          pushToLMS: this.pushToLMS.bind(this),
          disconnectSession: this.disconnectSession.bind(this)
        }
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to OpenAI
      await this.session.connect({ apiKey: this.config.apiKey });

      this.isConnected = true;
      logger.info('Successfully connected to OpenAI Realtime API');
      this.emit('connected');

    } catch (error) {
      logger.error('Failed to connect to OpenAI Realtime API', { error });
      this.emit('error', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.session) return;

    this.session.on('error', (error) => {
      logger.error('OpenAI Realtime session error', { error });
      this.emit('error', error);
    });

    this.session.on('agent_handoff', (data) => {
      logger.info('Agent handoff requested', { data });
      this.emit('handoff', data);
    });

    this.session.on('transport_event', (event) => {
      logger.debug('Transport event', { event });
      this.emit('transport_event', event);
    });
  }

  private captureSalesData(dataType: string, value: string, notes?: string): any {
    logger.info('Capturing sales data', { dataType, value, notes });
    
    // Store the data
    (this.salesData as any)[dataType] = value;
    
    // Emit event for bridge monitoring
    this.emit('data_captured', { dataType, value, notes });
    
    return { 
      success: true, 
      message: `${dataType} captured successfully`,
      data: this.salesData 
    };
  }

  private verifySalesData(dataType: string, confirmed: boolean): any {
    logger.info('Verifying sales data', { dataType, confirmed });
    
    if (!confirmed) {
      // Remove the data if not confirmed
      delete (this.salesData as any)[dataType];
      logger.info('Sales data rejected by customer', { dataType });
    }
    
    this.emit('data_verified', { dataType, confirmed });
    
    return { 
      success: true, 
      message: `${dataType} ${confirmed ? 'confirmed' : 'rejected'}` 
    };
  }

  private async pushToLMS(salesData: SalesData): Promise<any> {
    logger.info('Pushing complete sales data to LMS', { salesData });
    
    try {
      const result = await this.lmsService.pushSalesData(salesData);
      
      this.emit('lms_push', { salesData, result });
      
      return result;
    } catch (error) {
      logger.error('Failed to push to LMS', { error, salesData });
      return { 
        success: false, 
        message: 'Failed to push to LMS',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private disconnectSession(): void {
    logger.info('Session disconnect requested by agent');
    this.disconnect();
  }

  async sendAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.session || !this.isConnected) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    // Send audio to OpenAI Realtime session
    // Implementation depends on the actual OpenAI Realtime API
    logger.debug('Sending audio to OpenAI Realtime', { bufferSize: audioBuffer.length });
  }

  async receiveAudio(): Promise<AsyncIterable<Buffer>> {
    if (!this.session || !this.isConnected) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    // Return audio stream from OpenAI Realtime session
    // Implementation depends on the actual OpenAI Realtime API
    return this.createAudioStream();
  }

  private async *createAudioStream(): AsyncIterable<Buffer> {
    // Placeholder for audio stream implementation
    while (this.isConnected) {
      yield Buffer.alloc(0); // Placeholder
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  getSalesData(): Partial<SalesData> {
    return { ...this.salesData };
  }

  isDataComplete(): boolean {
    return !!(this.salesData.full_name && this.salesData.car_model && this.salesData.email_id);
  }

  disconnect(): void {
    if (this.session) {
      this.session.disconnect?.();
      this.session = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected');
    logger.info('Disconnected from OpenAI Realtime API');
  }
}
