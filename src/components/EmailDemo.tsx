import React, { useState, useEffect } from 'react';
import { 
  Send, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Zap, 
  Settings,
  Activity,
  Mail,
  Users,
  BarChart3
} from 'lucide-react';
import { EmailService } from '../services/email/EmailService';
import { MockProviderA, MockProviderB } from '../services/email';
import { EmailMessage, EmailStatus } from '../services/email/types';

const EmailDemo: React.FC = () => {
  const [emailService] = useState(() => {
    const providerA = new MockProviderA();
    const providerB = new MockProviderB();
    
    return new EmailService([providerA, providerB], {
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
  });

  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    body: ''
  });
  const [sending, setSending] = useState(false);
  const [statistics, setStatistics] = useState(emailService.getStatistics());
  const [emailStatuses, setEmailStatuses] = useState<EmailStatus[]>([]);
  const [lastResult, setLastResult] = useState<string>('');

  // Update statistics every second
  useEffect(() => {
    const interval = setInterval(() => {
      setStatistics(emailService.getStatistics());
      setEmailStatuses(emailService.getAllEmailStatuses());
    }, 1000);

    return () => clearInterval(interval);
  }, [emailService]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.to || !emailForm.subject || !emailForm.body) return;

    setSending(true);
    setLastResult('');

    try {
      const message: EmailMessage = {
        id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        priority: 'normal',
        timestamp: Date.now()
      };

      const result = await emailService.sendEmail(message);
      
      if (result.success) {
        setLastResult(`✅ Email sent successfully via ${result.provider}`);
        setEmailForm({ to: '', subject: '', body: '' });
      } else {
        setLastResult(`❌ Email failed: ${result.error}`);
      }
    } catch (error) {
      setLastResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const handleBulkTest = async () => {
    setSending(true);
    setLastResult('Sending bulk test emails...');

    const testEmails = [
      { to: 'user1@example.com', subject: 'Test 1', body: 'This is test email 1' },
      { to: 'user2@example.com', subject: 'Test 2', body: 'This is test email 2' },
      { to: 'invalid@example.com', subject: 'Test 3', body: 'This should fail validation' },
      { to: 'user3@example.com', subject: 'Test 4', body: 'This is test email 4' },
      { to: 'blocked@example.com', subject: 'Test 5', body: 'This should be blocked' },
      { to: 'user4@example.com', subject: 'Test 6', body: 'This is test email 6' },
    ];

    const results = await Promise.all(testEmails.map(async (email, index) => {
      const message: EmailMessage = {
        id: `bulk-test-${Date.now()}-${index}`,
        ...email,
        priority: 'normal',
        timestamp: Date.now()
      };

      try {
        const result = await emailService.sendEmail(message);
        return { email: email.to, success: result.success, error: result.error, provider: result.provider };
      } catch (error) {
        return { email: email.to, success: false, error: error instanceof Error ? error.message : 'Unknown error', provider: null };
      }
    }));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    const resultSummary = `Bulk test completed! ${successful} succeeded, ${failed} failed.\n\nResults:\n` +
      results.map(r => `• ${r.email}: ${r.success ? `✅ Sent via ${r.provider}` : `❌ Failed - ${r.error}`}`).join('\n');
    
    setLastResult(resultSummary);
    setSending(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'sending': return 'text-blue-600';
      case 'queued': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'sending': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'queued': return <Clock className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getCircuitBreakerColor = (state: string) => {
    switch (state) {
      case 'closed': return 'text-green-600';
      case 'open': return 'text-red-600';
      case 'half-open': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Resilient Email Service
          </h1>
          <p className="text-lg text-gray-600">
            Production-ready email service with retry logic, fallback, rate limiting, and circuit breakers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Send className="w-5 h-5 mr-2" />
                Send Email
              </h2>
              
              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
                    To
                  </label>
                  <input
                    type="email"
                    id="to"
                    value={emailForm.to}
                    onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Try: invalid@example.com (validation error) or blocked@example.com (provider B error)
                  </p>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your email subject"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="body"
                    value={emailForm.body}
                    onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your email message"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {sending ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {sending ? 'Sending...' : 'Send Email'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleBulkTest}
                    disabled={sending}
                    className="bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Bulk Test
                  </button>
                </div>
              </form>

              {lastResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{lastResult}</pre>
                </div>
              )}
            </div>

            {/* Email Status History */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Email Status History
              </h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {emailStatuses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No emails sent yet</p>
                ) : (
                  emailStatuses.slice().reverse().map((status) => (
                    <div key={status.messageId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className={`mr-3 ${getStatusColor(status.status)}`}>
                          {getStatusIcon(status.status)}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            To: {status.recipient}
                          </p>
                          <p className="text-xs text-gray-600">
                            Subject: {status.subject}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {status.messageId}
                          </p>
                          <p className="text-xs text-gray-500">
                            {status.attempts} attempts
                            {status.provider && ` • ${status.provider}`}
                            {status.error && ` • ${status.error}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(status.status)}`}>
                        {status.status.toUpperCase()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Statistics Panel */}
          <div className="space-y-6">
            {/* Overall Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Statistics
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{statistics.sent}</div>
                  <div className="text-xs text-gray-500">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statistics.pending}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{statistics.queued}</div>
                  <div className="text-xs text-gray-500">Queued</div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600">
                Total: {statistics.total} emails
              </div>
            </div>

            {/* Rate Limiter */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Rate Limiter
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Available Tokens:</span>
                  <span className="font-medium">{statistics.rateLimitTokens}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Queue Size:</span>
                  <span className="font-medium">{statistics.queueSize}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(statistics.rateLimitTokens / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Circuit Breakers */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Circuit Breakers
              </h3>
              
              <div className="space-y-3">
                {Object.entries(statistics.circuitBreakers).map(([provider, info]) => (
                  <div key={provider} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium text-sm">{provider}</div>
                      <div className="text-xs text-gray-500">{info.failures} failures</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${getCircuitBreakerColor(info.state)}`}>
                      {info.state.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => emailService.resetCircuitBreakers()}
                className="mt-3 w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 text-sm"
              >
                Reset Circuit Breakers
              </button>
            </div>

            {/* Recent Logs */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Recent Logs
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {statistics.recentLogs.map((log, index) => (
                  <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${
                        log.level === 'error' ? 'text-red-600' : 
                        log.level === 'warn' ? 'text-yellow-600' : 
                        'text-blue-600'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-700">{log.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDemo;