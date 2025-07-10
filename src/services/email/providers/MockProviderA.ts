import { EmailProvider, EmailMessage, EmailResult } from '../types';

/**
 * Mock Email Provider A - Simulates a primary email service
 * Has a 70% success rate with random failures
 */
export class MockProviderA implements EmailProvider {
  name = 'Provider A';
  private failureRate = 0.3;
  private latencyMs = 100;

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    // Simulate network latency
    await this.delay(this.latencyMs + Math.random() * 200);

    // Simulate random failures
    if (Math.random() < this.failureRate) {
      throw new Error(`${this.name}: Network timeout or service unavailable`);
    }

    // Simulate specific email validation failures
    if (message.to.includes('invalid')) {
      throw new Error(`${this.name}: Invalid email address format`);
    }

    return {
      success: true,
      messageId: `${this.name.toLowerCase().replace(' ', '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: this.name,
      timestamp: Date.now()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to adjust failure rate for testing
  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }
}