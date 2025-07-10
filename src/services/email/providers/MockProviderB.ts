import { EmailProvider, EmailMessage, EmailResult } from '../types';

/**
 * Mock Email Provider B - Simulates a backup email service
 * Has a 80% success rate with different failure patterns
 */
export class MockProviderB implements EmailProvider {
  name = 'Provider B';
  private failureRate = 0.2;
  private latencyMs = 150;

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    // Simulate higher latency than Provider A
    await this.delay(this.latencyMs + Math.random() * 300);

    // Simulate random failures
    if (Math.random() < this.failureRate) {
      throw new Error(`${this.name}: Rate limit exceeded or temporary service error`);
    }

    // Simulate different validation patterns
    if (message.to.includes('blocked')) {
      throw new Error(`${this.name}: Recipient blocked or domain not allowed`);
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