import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { spotlightAgentConfig, spotlightTools } from '../agents/spotlight-agent.js';
import { SessionManager } from '../utils/session-manager.js';
import logger from '../utils/logger.js';

export interface OpenAIRealtimeOptions {
  apiKey: string;
  model: string;
  audioFormat: string;
  sessionManager: SessionManager;
}

export class OpenAIRealtimeConnector extends EventEmitter {
  private apiKey: string;
  private model: string;
  private audioFormat: string;
  private sessionManager: SessionManager;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private sessionId: string | null = null;

  constructor(options: OpenAIRealtimeOptions) {
    super();
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.audioFormat = options.audioFormat;
    this.sessionManager = options.sessionManager;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected to OpenAI Realtime API');
      return;
    }

    try {
      logger.info('Connecting to OpenAI Realtime API with Spotlight Agent...');

      // Create WebSocket connection to OpenAI Realtime API
      const url = 'wss://api.openai.com/v1/realtime?model=' + this.model;
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.setupWebSocketHandlers();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Initialize session with Spotlight agent
      await this.initializeSpotlightSession();

      this.isConnected = true;
      this.emit('connected');
      logger.info('Connected to OpenAI Realtime API with Spotlight Agent');

    } catch (error) {
      logger.error('Failed to connect to OpenAI Realtime API:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info('OpenAI Realtime WebSocket connection opened');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleRealtimeMessage(message);
      } catch (error) {
        logger.error('Failed to parse realtime message:', error);
      }
    });

    this.ws.on('error', (error) => {
      logger.error('OpenAI Realtime WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('close', () => {
      logger.warn('OpenAI Realtime WebSocket connection closed');
      this.isConnected = false;
      this.emit('disconnected');
    });
  }

  private async initializeSpotlightSession(): Promise<void> {
    if (!this.ws) return;

    // Create new session
    this.sessionId = `session_${Date.now()}`;
    const session = this.sessionManager.createSession(this.sessionId, 'spotlight');

    // Send session configuration with Spotlight agent
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: spotlightAgentConfig.instructions,
        voice: spotlightAgentConfig.voice,
        input_audio_format: this.audioFormat,
        output_audio_format: this.audioFormat,
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: spotlightAgentConfig.tools,
        temperature: spotlightAgentConfig.temperature,
        max_response_output_tokens: spotlightAgentConfig.max_response_output_tokens
      }
    };

    this.ws.send(JSON.stringify(sessionConfig));
    logger.info('Sent Spotlight agent configuration to OpenAI');
  }

  private handleRealtimeMessage(message: any): void {
    logger.debug('Received realtime message:', message.type);

    switch (message.type) {
      case 'session.created':
        logger.info('Realtime session created:', message.session.id);
        break;

      case 'session.updated':
        logger.info('Realtime session updated with Spotlight agent');
        break;

      case 'conversation.item.created':
        if (message.item.type === 'function_call') {
          this.handleFunctionCall(message.item);
        }
        break;

      case 'response.function_call_arguments.done':
        this.handleFunctionCall(message);
        break;

      case 'response.audio.delta':
        // Handle audio streaming
        this.emit('audio_output', message.delta);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        logger.info('Audio transcription:', message.transcript);
        break;

      case 'error':
        logger.error('OpenAI Realtime error:', message.error);
        this.emit('error', message.error);
        break;

      default:
        this.emit('transport_event', message);
        break;
    }
  }

  private async handleFunctionCall(item: any): Promise<void> {
    const functionName = item.name || item.function?.name;
    const args = JSON.parse(item.arguments || item.function?.arguments || '{}');

    logger.info('Handling function call:', functionName, args);

    try {
      let result;

      // Execute Spotlight agent tools
      if (spotlightTools[functionName as keyof typeof spotlightTools]) {
        result = await spotlightTools[functionName as keyof typeof spotlightTools](args, item);
        
        // Emit events for different tool types
        switch (functionName) {
          case 'capture_sales_data':
          case 'capture_all_sales_data':
            this.emit('data_captured', args);
            break;
          case 'verify_sales_data':
            this.emit('data_verified', args);
            break;
          case 'push_to_lms':
            this.emit('lms_push', args);
            break;
          case 'disconnect_session':
            this.emit('handoff', { target: 'car_dealer', data: args });
            break;
        }
      } else {
        result = { error: `Unknown function: ${functionName}` };
      }

      // Send function result back to OpenAI
      if (this.ws && item.call_id) {
        const response = {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify(result)
          }
        };
        this.ws.send(JSON.stringify(response));
      }

    } catch (error) {
      logger.error('Function call error:', error);
      this.emit('error', error);
    }
  }

  sendAudio(audioData: Buffer): void {
    if (!this.ws || !this.isConnected) {
      logger.warn('Cannot send audio - not connected');
      return;
    }

    const audioMessage = {
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64')
    };

    this.ws.send(JSON.stringify(audioMessage));
  }

  sendText(text: string): void {
    if (!this.ws || !this.isConnected) {
      logger.warn('Cannot send text - not connected');
      return;
    }

    const textMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    };

    this.ws.send(JSON.stringify(textMessage));

    // Trigger response generation
    const responseMessage = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Please respond as the Spotlight agent.'
      }
    };

    this.ws.send(JSON.stringify(responseMessage));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    
    if (this.sessionId) {
      this.sessionManager.endSession(this.sessionId);
      this.sessionId = null;
    }
    
    logger.info('Disconnected from OpenAI Realtime API');
  }
}