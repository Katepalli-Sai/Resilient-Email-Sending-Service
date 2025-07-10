import { CircuitBreaker } from '../utils/CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 5000
    });
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should remain closed for successful operations', async () => {
    const successfulOperation = async () => 'success';
    
    const result = await circuitBreaker.execute(successfulOperation);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after failure threshold is reached', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    
    // Execute failing operation multiple times
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    expect(circuitBreaker.getState()).toBe('open');
  });

  it('should reject calls when open', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    
    // Trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Should be open now
    expect(circuitBreaker.getState()).toBe('open');
    
    // Next call should be rejected immediately
    await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to half-open after reset timeout', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    
    // Trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    expect(circuitBreaker.getState()).toBe('open');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Next operation should transition to half-open
    try {
      await circuitBreaker.execute(failingOperation);
    } catch (error) {
      // Expected to fail, but state should be half-open briefly
    }
    
    expect(circuitBreaker.getState()).toBe('open'); // Should go back to open after failure
  });

  it('should reset failure count on successful operation', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    
    const successfulOperation = async () => 'success';
    
    // Have some failures
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    expect(circuitBreaker.getFailureCount()).toBe(2);
    
    // Successful operation should reset count
    await circuitBreaker.execute(successfulOperation);
    expect(circuitBreaker.getFailureCount()).toBe(0);
  });
});