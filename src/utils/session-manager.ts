export interface BridgeSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended' | 'error';
  metadata: Record<string, any>;
}

export class SessionManager {
  private sessions: Map<string, BridgeSession> = new Map();

  createSession(metadata: Record<string, any> = {}): BridgeSession {
    const session: BridgeSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      status: 'active',
      metadata
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): BridgeSession | undefined {
    return this.sessions.get(id);
  }

  endSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.endTime = new Date();
      session.status = 'ended';
    }
  }

  markSessionError(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.endTime = new Date();
      session.status = 'error';
    }
  }

  getActiveSessions(): BridgeSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  private generateSessionId(): string {
    return 'bridge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}