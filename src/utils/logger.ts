// SPDX-FileCopyrightText: 2024 VoiceAgent Team
// SPDX-License-Identifier: Apache-2.0

import pino from 'pino';

export class Logger {
  private logger: pino.Logger;
  private component: string;

  constructor(component: string) {
    this.component = component;
    
    // Configure pino logger with structured logging
    this.logger = pino({
      name: 'voiceagent-bridge',
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        },
        log: (object) => {
          return {
            ...object,
            component: this.component,
            timestamp: new Date().toISOString()
          };
        }
      },
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,component'
        }
      } : undefined
    });
  }

  info(message: string, ...args: any[]): void {
    this.logger.info({ component: this.component }, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn({ component: this.component }, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.logger.error({ component: this.component }, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug({ component: this.component }, message, ...args);
  }

  trace(message: string, ...args: any[]): void {
    this.logger.trace({ component: this.component }, message, ...args);
  }

  fatal(message: string, ...args: any[]): void {
    this.logger.fatal({ component: this.component }, message, ...args);
  }

  child(bindings: any): Logger {
    const childLogger = new Logger(this.component);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}
