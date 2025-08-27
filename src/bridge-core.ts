// SPDX-FileCopyrightText: 2024 VoiceAgent Team
// SPDX-License-Identifier: Apache-2.0

import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIPAdapter } from './adapters/sip-adapter.js';
import { SI2Connector } from './connectors/si2-connector.js';
import { AudioPipeline } from './utils/audio-pipeline.js';
import { SessionManager } from './utils/session-manager.js';
import { Logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

const logger = new Logger('BridgeCore');

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    logger.info('🔄 Prewarming bridge components...');
    proc.userData.vad = await silero.VAD.load();
    proc.userData.sessionManager = new SessionManager();
    proc.userData.audioPipeline = new AudioPipeline();
    logger.info('✅ Bridge components prewarmed');
  },
  
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;
    const sessionManager = ctx.proc.userData.sessionManager! as SessionManager;
    const audioPipeline = ctx.proc.userData.audioPipeline! as AudioPipeline;
    
    logger.info('🌉 Starting VoiceAgent Bridge session');
    logger.info(`📞 Room: ${ctx.room.name}`);
    logger.info(`🔗 Job ID: ${ctx.job.id}`);
    
    // Parse metadata to determine bridge configuration
    const metadata = ctx.job.metadata || '{}';
    let bridgeConfig;
    
    try {
      bridgeConfig = JSON.parse(metadata);
      logger.info(`⚙️ Bridge config: ${JSON.stringify(bridgeConfig)}`);
    } catch (e) {
      logger.warn('⚠️ Invalid metadata, using default bridge config');
      bridgeConfig = {
        protocol: 'sip',
        si2Endpoint: process.env.SI2_ENDPOINT || 'ws://localhost:3001',
        scenario: 'singleInterface'
      };
    }
    
    // Connect to LiveKit room
    await ctx.connect();
    logger.info('🔗 Connected to LiveKit room');
    
    // Wait for participant (incoming call)
    logger.info('⏳ Waiting for participant...');
    const participant = await ctx.waitForParticipant();
    logger.info(`👤 Participant connected: ${participant.identity}`);
    
    // Create session
    const session = sessionManager.createSession({
      sessionId: ctx.job.id,
      roomName: ctx.room.name!,
      participantId: participant.identity,
      protocol: bridgeConfig.protocol,
      config: bridgeConfig
    });
    
    try {
      // Initialize protocol adapter
      const adapter = new SIPAdapter(session, vad, audioPipeline);
      
      // Initialize SingleInterface 2.0 connector
      const si2Connector = new SI2Connector(bridgeConfig.si2Endpoint);
      await si2Connector.connect();
      
      // Start bridge session
      await adapter.start(ctx.room, participant, si2Connector);
      
      logger.info('🚀 Bridge session started successfully');
      logger.info('🔄 Audio pipeline active');
      
    } catch (error) {
      logger.error('❌ Bridge session failed:', error);
      sessionManager.endSession(session.sessionId);
      throw error;
    }
  },
});

cli.runApp(new WorkerOptions({ 
  agent: fileURLToPath(import.meta.url),
  agentName: 'voiceagent-bridge' // Bridge-specific agent name
}));
