// SPDX-FileCopyrightText: 2024 VoiceAgent Team
// SPDX-License-Identifier: Apache-2.0

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';

export interface AgentHandoffData {
  from: string;
  to: string;
  reason: string;
  timestamp: Date;
  context?: any;
}

export interface DataCollectionPoint {
  type: string;
  value: any;
  agent: string;
  timestamp: Date;
  metadata?: any;
}

export interface SI2Message {
  type: 'audio' | 'text' | 'handoff' | 'data_collection' | 'session_end' | 'greeting';
  payload: any;
  timestamp: Date;
  sessionId?: string;
}

export class SI2Connector extends EventEmitter {
  private logger: Logger;
  private ws?: WebSocket;
  private endpoint: string;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(endpoint: string) {
    super();
    this.logger = new Logger('SI2Connector');
    this.endpoint = endpoint;
  }

  async connect(): Promise<void> {
    this.logger.info(`🔗 Connecting to SingleInterface 2.0: ${this.endpoint}`);

    try {
      this.ws = new WebSocket(this.endpoint);
      
      this.ws.on('open', () => {
        this.logger.info('✅ Connected to SingleInterface 2.0');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send initial greeting to start the agent flow
        this.sendGreeting();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.logger.warn('⚠️ Connection to SingleInterface 2.0 closed');
        this.isConnected = false;
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        this.logger.error('❌ SingleInterface 2.0 connection error:', error);
        this.emit('error', error);
      });

      // Wait for connection to establish
      await new Promise((resolve, reject) => {
        this.ws!.on('open', resolve);
        this.ws!.on('error', reject);
      });

    } catch (error) {
      this.logger.error('❌ Failed to connect to SingleInterface 2.0:', error);
      throw error;
    }
  }

  private sendGreeting(): void {
    this.logger.info('👋 Sending greeting to start agent flow');
    const greetingMessage: SI2Message = {
      type: 'greeting',
      payload: {
        action: 'start_session',
        protocol: 'telephony',
        source: 'voiceagent-bridge'
      },
      timestamp: new Date()
    };
    this.sendMessage(greetingMessage);
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: SI2Message = JSON.parse(data.toString());
      this.logger.debug(`📨 Received message: ${message.type}`);

      switch (message.type) {
        case 'audio':
          this.emit('audio', message.payload);
          break;
        
        case 'text':
          this.emit('text', message.payload);
          break;
        
        case 'handoff':
          this.logger.info(`🔄 Agent handoff: ${message.payload.from} → ${message.payload.to}`);
          this.emit('handoff', message.payload as AgentHandoffData);
          break;
        
        case 'data_collection':
          this.logger.info(`📊 Data point collected: ${message.payload.type}`);
          this.emit('data_collection', message.payload as DataCollectionPoint);
          break;
        
        case 'session_end':
          this.logger.info('🏁 Session ended by SingleInterface 2.0');
          this.emit('session_end');
          break;
        
        default:
          this.logger.warn(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('❌ Error parsing message:', error);
    }
  }

  private sendMessage(message: SI2Message): void {
    if (!this.isConnected || !this.ws) {
      this.logger.warn('⚠️ Cannot send message: not connected to SingleInterface 2.0');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.logger.debug(`📤 Sent message: ${message.type}`);
    } catch (error) {
      this.logger.error('❌ Error sending message:', error);
    }
  }

  async sendAudio(audioBuffer: Buffer): Promise<void> {
    const message: SI2Message = {
      type: 'audio',
      payload: {
        data: audioBuffer.toString('base64'),
        format: 'pcm',
        sampleRate: 16000,
        channels: 1
      },
      timestamp: new Date()
    };
    this.sendMessage(message);
  }

  async sendAudioStream(audioStream: AsyncIterable<Buffer>): Promise<void> {
    for await (const chunk of audioStream) {
      await this.sendAudio(chunk);
    }
  }

  async sendText(text: string): Promise<void> {
    const message: SI2Message = {
      type: 'text',
      payload: { text },
      timestamp: new Date()
    };
    this.sendMessage(message);
  }

  async *receiveAudio(): AsyncIterable<Buffer> {
    const audioEmitter = new EventEmitter();
    
    this.on('audio', (audioData) => {
      audioEmitter.emit('audio', audioData);
    });

    while (this.isConnected) {
      const audioData = await new Promise<any>((resolve) => {
        audioEmitter.once('audio', resolve);
      });
      
      if (audioData.data) {
        yield Buffer.from(audioData.data, 'base64');
      }
    }
  }

  async *receiveText(): AsyncIterable<string> {
    const textEmitter = new EventEmitter();
    
    this.on('text', (textData) => {
      textEmitter.emit('text', textData);
    });

    while (this.isConnected) {
      const textData = await new Promise<any>((resolve) => {
        textEmitter.once('text', resolve);
      });
      
      if (textData.text) {
        yield textData.text;
      }
    }
  }

  onAudioResponse(callback: (audioData: any) => void): void {
    this.on('audio', callback);
  }

  onAgentHandoff(callback: (handoffData: AgentHandoffData) => void): void {
    this.on('handoff', callback);
  }

  onDataCollection(callback: (dataPoint: DataCollectionPoint) => void): void {
    this.on('data_collection', callback);
  }

  onSessionEnd(callback: () => void): void {
    this.on('session_end', callback);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.logger.error('❌ Reconnection failed:', error);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  async disconnect(): Promise<void> {
    this.logger.info('🔌 Disconnecting from SingleInterface 2.0');
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.isConnected = false;
    this.logger.info('✅ Disconnected from SingleInterface 2.0');
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
