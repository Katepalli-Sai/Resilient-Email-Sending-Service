import { EmailService } from '../EmailService';
import { MockProviderA, MockProviderB } from '../index';
import { EmailMessage } from '../types';

describe('EmailService', () => {
  let emailService: EmailService;
  let providerA: MockProviderA;
  let providerB: MockProviderB;

  beforeEach(() => {
    providerA = new MockProviderA();
    providerB = new MockProviderB();
    
    emailService = new EmailService([providerA, providerB], {
      retry: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      },
      rateLimit: {
        maxRequests: 10,
        windowMs: 5000
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 5000,
        monitoringWindow: 10000
      },
      enableLogging: false
    });
  });

  afterEach(() => {
    emailService.clear();
  });

  const createTestMessage = (id: string = 'test-1'): EmailMessage => ({
    id,
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test Body',
    priority: 'normal',
    timestamp: Date.now()
  });

  describe('Basic Email Sending', () => {
    it('should send email successfully with Provider A', async () => {
      providerA.setFailureRate(0); // No failures
      const message = createTestMessage();
      
      const result = await emailService.sendEmail(message);
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('Provider A');
      expect(result.messageId).toBeDefined();
    });

    it('should track email status correctly', async () => {
      providerA.setFailureRate(0);
      const message = createTestMessage();
      
      await emailService.sendEmail(message);
      
      const status = emailService.getEmailStatus(message.id);
      expect(status).toBeDefined();
      expect(status!.status).toBe('sent');
      expect(status!.provider).toBe('Provider A');
      expect(status!.attempts).toBeGreaterThan(0);
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to Provider B when Provider A fails', async () => {
      providerA.setFailureRate(1); // Always fail
      providerB.setFailureRate(0); // Never fail
      
      const message = createTestMessage();
      const result = await emailService.sendEmail(message);
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('Provider B');
    });

    it('should fail when all providers fail', async () => {
      providerA.setFailureRate(1);
      providerB.setFailureRate(1);
      
      const message = createTestMessage();
      const result = await emailService.sendEmail(message);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed attempts', async () => {
      let callCount = 0;
      const originalSend = providerA.sendEmail;
      
      providerA.sendEmail = async (message: EmailMessage) => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return originalSend.call(providerA, message);
      };
      
      const message = createTestMessage();
      const result = await emailService.sendEmail(message);
      
      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
      
      const status = emailService.getEmailStatus(message.id);
      expect(status!.attempts).toBe(3);
    });
  });

  describe('Idempotency', () => {
    it('should prevent duplicate sends', async () => {
      providerA.setFailureRate(0);
      const message = createTestMessage();
      
      // Send first time
      const result1 = await emailService.sendEmail(message);
      expect(result1.success).toBe(true);
      
      // Send again with same ID
      const result2 = await emailService.sendEmail(message);
      expect(result2.success).toBe(true);
      
      // Should not send twice
      const stats = emailService.getStatistics();
      expect(stats.sent).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should queue emails when rate limit is exceeded', async () => {
      // Create service with very low rate limit
      const limitedService = new EmailService([providerA], {
        retry: {
          maxAttempts: 1,
          baseDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2
        },
        rateLimit: {
          maxRequests: 1,
          windowMs: 5000
        },
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 5000,
          monitoringWindow: 10000
        },
        enableLogging: false
      });

      providerA.setFailureRate(0);
      
      // First email should succeed
      const message1 = createTestMessage('test-1');
      const result1 = await limitedService.sendEmail(message1);
      expect(result1.success).toBe(true);
      
      // Second email should be queued
      const message2 = createTestMessage('test-2');
      const result2 = await limitedService.sendEmail(message2);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Rate limit exceeded');
      
      limitedService.clear();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after repeated failures', async () => {
      providerA.setFailureRate(1);
      providerB.setFailureRate(1);
      
      // Send multiple emails to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        const message = createTestMessage(`test-${i}`);
        await emailService.sendEmail(message);
      }
      
      const stats = emailService.getStatistics();
      const cbState = stats.circuitBreakers['Provider A'];
      
      // Circuit breaker should be open due to failures
      expect(cbState.state).toBe('open');
    });
  });

  describe('Statistics', () => {
    it('should track statistics correctly', async () => {
      providerA.setFailureRate(0);
      providerB.setFailureRate(1);
      
      // Send successful email
      const message1 = createTestMessage('test-1');
      await emailService.sendEmail(message1);
      
      // Send failing email
      const message2 = createTestMessage('test-2');
      await emailService.sendEmail(message2);
      
      const stats = emailService.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.sent).toBe(2); // Both should eventually succeed due to fallback
      expect(stats.failed).toBe(0);
    });
  });
});