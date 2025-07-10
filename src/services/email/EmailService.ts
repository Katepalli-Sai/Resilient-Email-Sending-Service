import {
  EmailProvider,
  EmailMessage,
  EmailResult,
  EmailStatus,
  EmailServiceOptions,
  RetryOptions
} from './types';
import { RateLimiter } from './utils/RateLimiter';
import { CircuitBreaker } from './utils/CircuitBreaker';
import { Logger } from './utils/Logger';

/**
 * Resilient Email Service with retry logic, fallback, idempotency, and rate limiting
 */
export class EmailService {
  private readonly providers: EmailProvider[];
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly logger: Logger;
  private readonly emailStatuses: Map<string, EmailStatus> = new Map();
  private readonly sentEmails: Set<string> = new Set(); // For idempotency
  private readonly emailQueue: EmailMessage[] = [];
  private isProcessingQueue = false;

  constructor(
    providers: EmailProvider[],
    private options: EmailServiceOptions
  ) {
    this.providers = providers;
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.logger = new Logger();
    
    // Initialize circuit breakers for each provider
    providers.forEach(provider => {
      this.circuitBreakers.set(provider.name, new CircuitBreaker(options.circuitBreaker));
    });

    if (options.enableLogging) {
      this.logger.info('EmailService initialized', {
        providers: providers.map(p => p.name),
        options: this.options
      });
    }
  }

  /**
   * Send email with full resilience features
   */
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    // Check for idempotency
    if (this.sentEmails.has(message.id)) {
      const status = this.emailStatuses.get(message.id);
      if (status && status.status === 'sent') {
        this.logger.info('Email already sent (idempotency check)', { messageId: message.id });
        return {
          success: true,
          messageId: message.id,
          provider: status.provider || 'unknown',
          timestamp: status.lastAttempt || Date.now()
        };
      }
    }

    // Check if all circuit breakers are open
    const allCircuitBreakersOpen = this.providers.every(provider => {
      const circuitBreaker = this.circuitBreakers.get(provider.name);
      return circuitBreaker && circuitBreaker.getState() === 'open';
    });

    if (allCircuitBreakersOpen) {
      this.logger.warn('All circuit breakers are open, queuing email', { messageId: message.id });
      this.addToQueue(message);
      
      return {
        success: false,
        error: 'All providers temporarily unavailable. Email queued for retry.',
        provider: 'queue',
        timestamp: Date.now()
      };
    }

    // Check rate limit
    if (!(await this.rateLimiter.acquire())) {
      const waitTime = this.rateLimiter.getRemainingTime();
      this.logger.warn('Rate limit exceeded', { messageId: message.id, waitTime });
      
      // Add to queue instead of rejecting
      this.addToQueue(message);
      
      return {
        success: false,
        error: `Rate limit exceeded. Queued for processing in ${waitTime}ms`,
        provider: 'queue',
        timestamp: Date.now()
      };
    }

    // Initialize status tracking
    this.updateStatus(message.id, {
      messageId: message.id,
      recipient: message.to,
      subject: message.subject,
      status: 'sending',
      attempts: 0,
      created: Date.now()
    });

    try {
      const result = await this.sendWithRetryAndFallback(message);
      
      if (result.success) {
        this.sentEmails.add(message.id);
        this.updateStatus(message.id, {
          messageId: message.id,
          recipient: message.to,
          subject: message.subject,
          status: 'sent',
          attempts: this.emailStatuses.get(message.id)?.attempts || 0,
          provider: result.provider,
          lastAttempt: Date.now(),
          created: this.emailStatuses.get(message.id)?.created || Date.now()
        });
      } else {
        this.updateStatus(message.id, {
          messageId: message.id,
          recipient: message.to,
          subject: message.subject,
          status: 'failed',
          attempts: this.emailStatuses.get(message.id)?.attempts || 0,
          error: result.error,
          lastAttempt: Date.now(),
          created: this.emailStatuses.get(message.id)?.created || Date.now()
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.updateStatus(message.id, {
        messageId: message.id,
        recipient: message.to,
        subject: message.subject,
        status: 'failed',
        attempts: this.emailStatuses.get(message.id)?.attempts || 0,
        error: errorMessage,
        lastAttempt: Date.now(),
        created: this.emailStatuses.get(message.id)?.created || Date.now()
      });

      this.logger.error('Email sending failed', {
        messageId: message.id,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        provider: 'none',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Send email with retry logic and provider fallback
   */
  private async sendWithRetryAndFallback(message: EmailMessage): Promise<EmailResult> {
    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      const circuitBreaker = this.circuitBreakers.get(provider.name);
      if (!circuitBreaker) continue;

      try {
        const result = await this.sendWithRetry(message, provider, circuitBreaker);
        this.logger.info('Email sent successfully', {
          messageId: message.id,
          provider: provider.name,
          attempts: this.emailStatuses.get(message.id)?.attempts || 0
        });
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.logger.warn('Provider failed, trying next', {
          messageId: message.id,
          provider: provider.name,
          error: lastError.message
        });
      }
    }

    const errorMessage = lastError?.message || 'All providers failed';
    this.logger.error('All providers failed', {
      messageId: message.id,
      error: errorMessage
    });

    return {
      success: false,
      error: errorMessage,
      provider: 'none',
      timestamp: Date.now()
    };
  }

  /**
   * Send email with retry logic for a specific provider
   */
  private async sendWithRetry(
    message: EmailMessage,
    provider: EmailProvider,
    circuitBreaker: CircuitBreaker
  ): Promise<EmailResult> {
    const { maxAttempts, baseDelay, maxDelay, backoffFactor } = this.options.retry;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      this.incrementAttemptCount(message.id);

      try {
        const result = await circuitBreaker.execute(() => provider.sendEmail(message));
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.logger.warn('Send attempt failed', {
          messageId: message.id,
          provider: provider.name,
          attempt,
          error: errorMessage,
          isLastAttempt
        });

        if (isLastAttempt) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );

        await this.delay(delay);
      }
    }

    throw new Error(`Max attempts (${maxAttempts}) exceeded`);
  }

  /**
   * Add email to queue for later processing
   */
  private addToQueue(message: EmailMessage): void {
    this.emailQueue.push(message);
    this.updateStatus(message.id, {
      messageId: message.id,
      recipient: message.to,
      subject: message.subject,
      status: 'queued',
      attempts: 0,
      created: Date.now()
    });
    
    this.logger.info('Email added to queue', { messageId: message.id });
    this.processQueue();
  }

  /**
   * Process queued emails
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    this.logger.info('Processing queue', { queueSize: this.emailQueue.length });

    while (this.emailQueue.length > 0) {
      // Check if all circuit breakers are still open
      const allCircuitBreakersOpen = this.providers.every(provider => {
        const circuitBreaker = this.circuitBreakers.get(provider.name);
        return circuitBreaker && circuitBreaker.getState() === 'open';
      });

      if (allCircuitBreakersOpen) {
        this.logger.info('All circuit breakers still open, pausing queue processing');
        // Wait for circuit breakers to potentially reset
        await this.delay(5000); // Wait 5 seconds before checking again
        continue;
      }

      if (await this.rateLimiter.acquire()) {
        const message = this.emailQueue.shift();
        if (message) {
          try {
            await this.sendEmail(message);
          } catch (error) {
            this.logger.error('Failed to send queued email', {
              messageId: message.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      } else {
        // Wait for rate limit to reset
        const waitTime = this.rateLimiter.getRemainingTime();
        await this.delay(waitTime);
      }
    }

    this.isProcessingQueue = false;
    this.logger.info('Queue processing completed');
  }

  /**
   * Get email status
   */
  getEmailStatus(messageId: string): EmailStatus | undefined {
    return this.emailStatuses.get(messageId);
  }

  /**
   * Get all email statuses
   */
  getAllEmailStatuses(): EmailStatus[] {
    return Array.from(this.emailStatuses.values());
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    const statuses = this.getAllEmailStatuses();
    const circuitBreakerStates = Object.fromEntries(
      Array.from(this.circuitBreakers.entries()).map(([name, cb]) => [
        name,
        { state: cb.getState(), failures: cb.getFailureCount() }
      ])
    );

    return {
      total: statuses.length,
      sent: statuses.filter(s => s.status === 'sent').length,
      failed: statuses.filter(s => s.status === 'failed').length,
      pending: statuses.filter(s => s.status === 'pending').length,
      queued: statuses.filter(s => s.status === 'queued').length,
      queueSize: this.emailQueue.length,
      rateLimitTokens: this.rateLimiter.getAvailableTokens(),
      circuitBreakers: circuitBreakerStates,
      recentLogs: this.logger.getRecentLogs(10)
    };
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
    this.logger.info('Circuit breakers reset');
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.emailStatuses.clear();
    this.sentEmails.clear();
    this.emailQueue.length = 0;
    this.resetCircuitBreakers();
    this.logger.clear();
  }

  // Utility methods
  private updateStatus(messageId: string, status: EmailStatus): void {
    this.emailStatuses.set(messageId, status);
  }

  private incrementAttemptCount(messageId: string): void {
    const status = this.emailStatuses.get(messageId);
    if (status) {
      status.attempts++;
      this.emailStatuses.set(messageId, status);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}