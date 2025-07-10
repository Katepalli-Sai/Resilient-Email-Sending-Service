/**
 * Core types and interfaces for the resilient email service
 */

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high';
  timestamp: number;
}

export interface EmailProvider {
  name: string;
  sendEmail(message: EmailMessage): Promise<EmailResult>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: number;
}

export interface EmailStatus {
  messageId: string;
  recipient: string;
  subject: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'queued';
  attempts: number;
  lastAttempt?: number;
  provider?: string;
  error?: string;
  created: number;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

export interface EmailServiceOptions {
  retry: RetryOptions;
  rateLimit: RateLimitOptions;
  circuitBreaker: CircuitBreakerOptions;
  enableLogging: boolean;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}