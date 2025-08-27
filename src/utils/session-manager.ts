// SPDX-FileCopyrightText: 2024 VoiceAgent Team
// SPDX-License-Identifier: Apache-2.0

import { DataCollectionPoint } from '../connectors/si2-connector.js';
import { Logger } from './logger.js';

export interface BridgeSession {
  sessionId: string;
  roomName: string;
  participantId: string;
  protocol: 'sip' | 'webrtc' | 'websocket';
  startTime: Date;
  endTime?: Date;
  currentAgent: string;
  collectedData: DataCollectionPoint[];
  config: any;
  stats: SessionStats;
}

export interface SessionStats {
  audioChunksProcessed: number;
  messagesExchanged: number;
  agentHandoffs: number;
  dataPointsCollected: number;
  errors: number;
  avgLatency: number;
}

export interface SessionConfig {
  sessionId: string;
  roomName: string;
  participantId: string;
  protocol: 'sip' | 'webrtc' | 'websocket';
  config: any;
}

export class SessionManager {
  private logger: Logger;
  private activeSessions: Map<string, BridgeSession>;
  private sessionHistory: BridgeSession[];

  constructor() {
    this.logger = new Logger('SessionManager');
    this.activeSessions = new Map();
    this.sessionHistory = [];
    
    this.logger.info('📋 Session manager initialized');
  }

  /**
   * Create a new bridge session
   */
  createSession(config: SessionConfig): BridgeSession {
    this.logger.info(`🆕 Creating session: ${config.sessionId}`);
    
    const session: BridgeSession = {
      sessionId: config.sessionId,
      roomName: config.roomName,
      participantId: config.participantId,
      protocol: config.protocol,
      startTime: new Date(),
      currentAgent: 'authentication', // Default starting agent for singleInterface
      collectedData: [],
      config: config.config,
      stats: {
        audioChunksProcessed: 0,
        messagesExchanged: 0,
        agentHandoffs: 0,
        dataPointsCollected: 0,
        errors: 0,
        avgLatency: 0
      }
    };

    this.activeSessions.set(session.sessionId, session);
    
    this.logger.info(`✅ Session created: ${session.sessionId}`);
    this.logger.info(`📊 Active sessions: ${this.activeSessions.size}`);
    
    return session;
  }

  /**
   * Get an active session
   */
  getSession(sessionId: string): BridgeSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Update session statistics
   */
  updateSessionStats(sessionId: string, updates: Partial<SessionStats>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Session not found for stats update: ${sessionId}`);
      return;
    }

    Object.assign(session.stats, updates);
    this.logger.debug(`📊 Updated stats for session: ${sessionId}`);
  }

  /**
   * Add data collection point to session
   */
  addDataPoint(sessionId: string, dataPoint: DataCollectionPoint): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Session not found for data point: ${sessionId}`);
      return;
    }

    session.collectedData.push(dataPoint);
    session.stats.dataPointsCollected++;
    
    this.logger.info(`📊 Data point added to session ${sessionId}: ${dataPoint.type} = ${dataPoint.value}`);
  }

  /**
   * Record agent handoff
   */
  recordAgentHandoff(sessionId: string, fromAgent: string, toAgent: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Session not found for handoff: ${sessionId}`);
      return;
    }

    session.currentAgent = toAgent;
    session.stats.agentHandoffs++;
    
    this.logger.info(`🔄 Agent handoff recorded for session ${sessionId}: ${fromAgent} → ${toAgent}`);
  }

  /**
   * End a session
   */
  endSession(sessionId: string, reason?: string): BridgeSession | undefined {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Session not found for termination: ${sessionId}`);
      return undefined;
    }

    session.endTime = new Date();
    const duration = session.endTime.getTime() - session.startTime.getTime();
    
    this.logger.info(`🏁 Session ended: ${sessionId}`);
    this.logger.info(`⏱️ Duration: ${Math.round(duration / 1000)}s`);
    this.logger.info(`📊 Stats: ${JSON.stringify(session.stats)}`);
    if (reason) {
      this.logger.info(`📝 Reason: ${reason}`);
    }

    // Move to history
    this.sessionHistory.push(session);
    this.activeSessions.delete(sessionId);

    // Keep only last 100 sessions in history
    if (this.sessionHistory.length > 100) {
      this.sessionHistory = this.sessionHistory.slice(-100);
    }

    this.logger.info(`📊 Active sessions: ${this.activeSessions.size}`);
    
    return session;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): BridgeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session history
   */
  getSessionHistory(): BridgeSession[] {
    return [...this.sessionHistory];
  }

  /**
   * Get session statistics
   */
  getGlobalStats(): {
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
    totalDataPointsCollected: number;
    totalAgentHandoffs: number;
  } {
    const totalSessions = this.sessionHistory.length;
    
    const totalDuration = this.sessionHistory
      .filter(s => s.endTime)
      .reduce((sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()), 0);
    
    const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions / 1000 : 0;
    
    const totalDataPointsCollected = this.sessionHistory
      .reduce((sum, s) => sum + s.stats.dataPointsCollected, 0);
    
    const totalAgentHandoffs = this.sessionHistory
      .reduce((sum, s) => sum + s.stats.agentHandoffs, 0);

    return {
      activeSessions: this.activeSessions.size,
      totalSessions,
      averageSessionDuration,
      totalDataPointsCollected,
      totalAgentHandoffs
    };
  }

  /**
   * Clean up expired sessions (safety mechanism)
   */
  cleanupExpiredSessions(maxAgeHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.startTime < cutoffTime) {
        this.logger.warn(`🧹 Cleaning up expired session: ${sessionId}`);
        this.endSession(sessionId, 'Expired - cleanup');
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Export session data for analysis
   */
  exportSessionData(): any {
    return {
      activeSessions: this.getActiveSessions(),
      sessionHistory: this.getSessionHistory(),
      globalStats: this.getGlobalStats(),
      exportTimestamp: new Date()
    };
  }
}
