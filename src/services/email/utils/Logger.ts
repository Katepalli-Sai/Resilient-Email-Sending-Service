import { LogEntry } from '../types';

/**
 * Simple logging utility for the email service
 */
export class Logger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;

  log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context
    };

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output for development
    if (typeof console !== 'undefined') {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console[level](`[EmailService] ${message}${contextStr}`);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  getLogs(level?: LogEntry['level']): LogEntry[] {
    return level ? this.logs.filter(log => log.level === level) : [...this.logs];
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clear(): void {
    this.logs = [];
  }
}