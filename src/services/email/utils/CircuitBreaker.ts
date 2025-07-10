import { CircuitBreakerOptions } from '../types';

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount = 0;
  private readonly failureHistory: number[] = [];

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.cleanupHistory();
    
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureHistory.push(this.lastFailureTime);
    this.cleanupHistory();

    if (this.state === 'half-open') {
      this.state = 'open';
      return;
    }

    const recentFailures = this.failureHistory.filter(
      time => Date.now() - time < this.options.monitoringWindow
    );

    if (recentFailures.length >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  private cleanupHistory(): void {
    const cutoff = Date.now() - this.options.monitoringWindow;
    const index = this.failureHistory.findIndex(time => time >= cutoff);
    if (index > 0) {
      this.failureHistory.splice(0, index);
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
    this.successCount = 0;
    this.failureHistory.length = 0;
  }
}