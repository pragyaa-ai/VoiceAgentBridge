// SPDX-FileCopyrightText: 2024 VoiceAgent Team
// SPDX-License-Identifier: Apache-2.0

import { Room, RemoteParticipant } from '@livekit/rtc-node';
import * as silero from '@livekit/agents-plugin-silero';
import { AudioPipeline } from '../utils/audio-pipeline.js';
import { SessionManager, BridgeSession } from '../utils/session-manager.js';
import { SI2Connector } from '../connectors/si2-connector.js';
import { Logger } from '../utils/logger.js';

export interface CommunicationAdapter {
  connect(): Promise<void>;
  sendAudio(buffer: Buffer): Promise<void>;
  receiveAudio(): AsyncIterable<Buffer>;
  sendText(message: string): Promise<void>;
  receiveText(): AsyncIterable<string>;
  disconnect(): Promise<void>;
}

export class SIPAdapter implements CommunicationAdapter {
  private logger: Logger;
  private session: BridgeSession;
  private vad: silero.VAD;
  private audioPipeline: AudioPipeline;
  private room?: Room;
  private participant?: RemoteParticipant;
  private si2Connector?: SI2Connector;
  private isConnected = false;

  constructor(session: BridgeSession, vad: silero.VAD, audioPipeline: AudioPipeline) {
    this.logger = new Logger('SIPAdapter');
    this.session = session;
    this.vad = vad;
    this.audioPipeline = audioPipeline;
  }

  async connect(): Promise<void> {
    this.logger.info('🔗 Connecting SIP adapter...');
    this.isConnected = true;
    this.logger.info('✅ SIP adapter connected');
  }

  async start(room: Room, participant: RemoteParticipant, si2Connector: SI2Connector): Promise<void> {
    this.room = room;
    this.participant = participant;
    this.si2Connector = si2Connector;

    this.logger.info('🚀 Starting SIP bridge session');
    this.logger.info(`📞 Room: ${room.name}`);
    this.logger.info(`👤 Participant: ${participant.identity}`);

    await this.connect();
    await this.setupAudioBridge();
    await this.setupEventHandlers();

    this.logger.info('✅ SIP bridge session active');
  }

  private async setupAudioBridge(): Promise<void> {
    this.logger.info('🔊 Setting up audio bridge...');
    
    if (!this.participant || !this.si2Connector) {
      throw new Error('Participant or SI2 connector not initialized');
    }

    // Set up audio track handling (simplified for now)
    // TODO: Implement proper LiveKit track subscription handling
    this.logger.info('🔊 Setting up audio track handling...');
    
    // In production, this would handle real track events:
    // this.participant.on('trackSubscribed', async (track, publication, participant) => {
    //   if (track.kind === 'audio') {
    //     const audioStream = this.audioPipeline.createLiveKitToSI2Stream(track);
    //     await this.si2Connector!.sendAudioStream(audioStream);
    //   }
    // });

    // Set up audio response from SingleInterface 2.0 to LiveKit
    this.si2Connector.onAudioResponse(async (audioData) => {
      if (this.room) {
        const livekitAudio = this.audioPipeline.convertSI2ToLiveKit(audioData);
        await this.sendAudioToRoom(livekitAudio);
      }
    });

    this.logger.info('✅ Audio bridge configured');
  }

  private async setupEventHandlers(): Promise<void> {
    this.logger.info('⚙️ Setting up event handlers...');

    if (!this.si2Connector) {
      throw new Error('SI2 connector not initialized');
    }

    // Handle agent handoffs from SingleInterface 2.0
    this.si2Connector.onAgentHandoff((handoffData) => {
      this.logger.info(`🔄 Agent handoff: ${handoffData.from} → ${handoffData.to}`);
      this.session.currentAgent = handoffData.to;
    });

    // Handle data collection events
    this.si2Connector.onDataCollection((dataPoint) => {
      this.logger.info(`📊 Data collected: ${dataPoint.type} = ${dataPoint.value}`);
      this.session.collectedData.push(dataPoint);
    });

    // Handle session events
    this.si2Connector.onSessionEnd(() => {
      this.logger.info('🏁 Session ended by SingleInterface 2.0');
      this.disconnect();
    });

    this.logger.info('✅ Event handlers configured');
  }

  private async sendAudioToRoom(audioBuffer: Buffer): Promise<void> {
    if (!this.room) {
      this.logger.warn('⚠️ Cannot send audio: room not available');
      return;
    }

    try {
      // Convert audio buffer to LiveKit format and send to room
      // This is where we'd integrate with LiveKit's audio publishing APIs
      this.logger.debug('🔊 Sending audio to LiveKit room');
    } catch (error) {
      this.logger.error('❌ Error sending audio to room:', error);
    }
  }

  async sendAudio(buffer: Buffer): Promise<void> {
    if (!this.si2Connector) {
      throw new Error('SI2 connector not available');
    }

    const convertedBuffer = this.audioPipeline.convertLiveKitToSI2(buffer);
    await this.si2Connector.sendAudio(convertedBuffer);
  }

  async *receiveAudio(): AsyncIterable<Buffer> {
    if (!this.si2Connector) {
      throw new Error('SI2 connector not available');
    }

    for await (const audioData of this.si2Connector.receiveAudio()) {
      yield this.audioPipeline.convertSI2ToLiveKit(audioData);
    }
  }

  async sendText(message: string): Promise<void> {
    if (!this.si2Connector) {
      throw new Error('SI2 connector not available');
    }

    await this.si2Connector.sendText(message);
  }

  async *receiveText(): AsyncIterable<string> {
    if (!this.si2Connector) {
      throw new Error('SI2 connector not available');
    }

    for await (const text of this.si2Connector.receiveText()) {
      yield text;
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info('🔌 Disconnecting SIP adapter...');
    
    if (this.si2Connector) {
      await this.si2Connector.disconnect();
    }
    
    this.isConnected = false;
    this.logger.info('✅ SIP adapter disconnected');
  }
}
