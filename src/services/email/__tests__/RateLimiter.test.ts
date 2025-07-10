import { RateLimiter } from '../utils/RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000
    });
  });

  it('should allow requests within the limit', async () => {
    for (let i = 0; i < 5; i++) {
      const allowed = await rateLimiter.acquire();
      expect(allowed).toBe(true);
    }
  });

  it('should deny requests exceeding the limit', async () => {
    // Use up all tokens
    for (let i = 0; i < 5; i++) {
      await rateLimiter.acquire();
    }
    
    const denied = await rateLimiter.acquire();
    expect(denied).toBe(false);
  });

  it('should refill tokens over time', async () => {
    // Use up all tokens
    for (let i = 0; i < 5; i++) {
      await rateLimiter.acquire();
    }
    
    // Should be denied initially
    expect(await rateLimiter.acquire()).toBe(false);
    
    // Wait for some time to allow refill
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Should have some tokens available now
    expect(rateLimiter.getAvailableTokens()).toBeGreaterThan(0);
  });

  it('should report available tokens correctly', () => {
    const initialTokens = rateLimiter.getAvailableTokens();
    expect(initialTokens).toBe(5);
    
    rateLimiter.acquire();
    expect(rateLimiter.getAvailableTokens()).toBe(4);
  });
});