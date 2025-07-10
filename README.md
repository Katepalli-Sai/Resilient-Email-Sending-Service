# Resilient Email Service

A production-ready, resilient email sending service built with TypeScript, featuring retry logic, fallback mechanisms, idempotency, rate limiting, and circuit breakers.

## Features

### Core Features
- **Dual Provider Support**: Works with multiple email providers with automatic fallback
- **Retry Logic**: Exponential backoff retry mechanism for failed sends
- **Fallback Mechanism**: Automatically switches to backup provider on failure
- **Idempotency**: Prevents duplicate email sends with unique message IDs
- **Rate Limiting**: Token bucket algorithm to control send rates
- **Status Tracking**: Real-time tracking of email sending attempts and results

### Advanced Features
- **Circuit Breaker Pattern**: Prevents cascading failures by temporarily stopping requests to failing providers
- **Simple Logging**: Comprehensive logging with different levels (info, warn, error)
- **Basic Queue System**: Queues emails when rate limits are exceeded
- **Real-time Statistics**: Live monitoring of service performance and health

## Architecture

### Core Components

#### EmailService
The main service class that orchestrates all email sending operations.

```typescript
const emailService = new EmailService([providerA, providerB], {
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
  },
  rateLimit: {
    maxRequests: 5,
    windowMs: 10000
  },
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30000,
    monitoringWindow: 60000
  },
  enableLogging: true
});
```

#### Mock Email Providers
Two mock providers simulate real email services:
- **Provider A**: 70% success rate, simulates primary service
- **Provider B**: 80% success rate, simulates backup service

#### Utility Classes
- **RateLimiter**: Token bucket implementation for rate limiting
- **CircuitBreaker**: Circuit breaker pattern implementation
- **Logger**: Simple logging system with different levels

## Usage

### Basic Email Sending

```typescript
import { EmailService, MockProviderA, MockProviderB } from './services/email';

const service = new EmailService([new MockProviderA(), new MockProviderB()], options);

const message = {
  id: 'unique-message-id',
  to: 'user@example.com',
  subject: 'Hello World',
  body: 'This is a test email',
  priority: 'normal',
  timestamp: Date.now()
};

try {
  const result = await service.sendEmail(message);
  console.log('Email sent:', result);
} catch (error) {
  console.error('Failed to send email:', error);
}
```

### Monitoring and Statistics

```typescript
// Get service statistics
const stats = service.getStatistics();
console.log('Total emails:', stats.total);
console.log('Success rate:', stats.sent / stats.total);
console.log('Circuit breaker states:', stats.circuitBreakers);

// Get individual email status
const status = service.getEmailStatus('message-id');
console.log('Email status:', status.status);
console.log('Attempts:', status.attempts);
```

## Configuration Options

### Retry Configuration
```typescript
retry: {
  maxAttempts: 3,        // Maximum retry attempts
  baseDelay: 1000,       // Initial delay in milliseconds
  maxDelay: 5000,        // Maximum delay between retries
  backoffFactor: 2       // Exponential backoff multiplier
}
```

### Rate Limiting Configuration
```typescript
rateLimit: {
  maxRequests: 5,        // Maximum requests per window
  windowMs: 10000        // Time window in milliseconds
}
```

### Circuit Breaker Configuration
```typescript
circuitBreaker: {
  failureThreshold: 3,   // Failures before opening circuit
  resetTimeout: 30000,   // Time before attempting reset
  monitoringWindow: 60000 // Window for failure counting
}
```

## Error Handling

The service handles various error scenarios:

1. **Provider Failures**: Automatically switches to backup provider
2. **Rate Limiting**: Queues emails for later processing
3. **Circuit Breaker**: Prevents cascading failures
4. **Validation Errors**: Proper error propagation
5. **Retry Exhaustion**: Graceful failure with detailed error messages

## Testing

### Running Tests
```bash
npm test                    # Run all tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
```

### Test Coverage
The project includes comprehensive tests for:
- Email sending functionality
- Retry logic and fallback mechanisms
- Rate limiting behavior
- Circuit breaker patterns
- Idempotency guarantees
- Error handling scenarios

## Demo Application

The included demo application provides:
- Interactive email sending interface
- Real-time statistics and monitoring
- Circuit breaker status visualization
- Rate limiter status tracking
- Email history and status tracking
- Bulk testing capabilities

## Best Practices

1. **Idempotency**: Always use unique message IDs
2. **Error Handling**: Implement proper error handling in your application
3. **Monitoring**: Monitor circuit breaker states and success rates
4. **Rate Limiting**: Configure appropriate rate limits for your use case
5. **Logging**: Enable logging for production debugging
6. **Testing**: Use the mock providers for testing different failure scenarios

## Production Considerations

- Replace mock providers with real email service integrations
- Implement persistent storage for email status tracking
- Add authentication and authorization
- Implement proper error monitoring and alerting
- Consider implementing email templates and personalization
- Add metrics collection for performance monitoring

## License

This project is provided as a demonstration of resilient system design patterns and best practices for email services.