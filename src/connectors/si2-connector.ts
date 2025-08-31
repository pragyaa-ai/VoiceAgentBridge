import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface AgentHandoffData {
  fromAgent: string;
  toAgent: string;
  context: any;
}

export interface DataCollectionPoint {
  id: string;
  data: any;
  timestamp: number;
}

export class SI2Connector extends EventEmitter {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.endpoint);
      
      this.ws.on('open', () => {
        console.log('Connected to SingleInterface 2.0');
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.emit('disconnected');
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('Failed to connect to SI2:', error);
      throw error;
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'audio':
        this.emit('audio', message.payload);
        break;
      case 'text':
        this.emit('text', message.payload);
        break;
      case 'agent_handoff':
        this.emit('handoff', message.payload as AgentHandoffData);
        break;
      case 'data_collection':
        this.emit('data_collection', message.payload as DataCollectionPoint);
        break;
      case 'session_end':
        this.emit('session_end');
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, 2000 * this.reconnectAttempts);
    }
  }

  async sendAudio(audioBuffer: Buffer): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'audio',
        payload: {
          data: audioBuffer.toString('base64'),
          format: 'pcm',
          sampleRate: 16000
        }
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  async sendText(text: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'text',
        payload: { text }
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}