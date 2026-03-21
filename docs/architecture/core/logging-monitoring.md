# Logging & Monitoring

## Overview

Comprehensive logging and monitoring system with **two distinct logging systems**:
1. **DebugLogger** - Development/debugging logs with environment-based filtering
2. **SystemLogger** - Production monitoring logs that always run regardless of debug settings

Both systems feature structured logging, PII sanitization, and specialized logging helpers.

**Key Features:**
- **DebugLogger**: Centralized `debugLog` utility with structured context for development
- **SystemLogger**: Always-on production logging for system health, security, and infrastructure monitoring
- PII sanitization for GDPR compliance (automatic in both loggers)
- Environment-based log level control (`DEBUG_ENABLED`, `LOG_LEVEL`) for DebugLogger
- Specialized logging helpers (API calls, time conversions, component lifecycle)
- Global error handling and application monitoring
- Memory and Redis health checks
- Database performance monitoring

---

## Table of Contents

1. [Dual Logging System](#dual-logging-system)
2. [DebugLogger Implementation](#debuglogger-implementation)
3. [SystemLogger Implementation](#systemlogger-implementation)
4. [Log Levels & Filtering](#log-levels--filtering)
5. [Structured Logging](#structured-logging)
6. [PII Sanitization](#pii-sanitization)
7. [Specialized Logging Helpers](#specialized-logging-helpers)
8. [Application Monitoring](#application-monitoring)
9. [Database Performance Monitoring](#database-performance-monitoring)
10. [Real Project Examples](#real-project-examples)
11. [Best Practices](#best-practices)
12. [Metrics and Observability](#metrics-and-observability)

---

## Dual Logging System

### When to Use Each Logger

**DebugLogger (`debugLog`):**
- Development and debugging
- Feature-specific logging
- User action tracking
- API request/response logging
- Can be disabled in production via `DEBUG_ENABLED=false`

**SystemLogger (`systemLogger`):**
- Production system health monitoring
- Security events (authentication, rate limiting, IP blocking)
- Infrastructure alerts (memory, Redis, database)
- Critical system events
- **Always runs** regardless of debug settings

### Quick Reference

```typescript
// Development/Debug logging (can be disabled)
import debugLog from '@/shared/utils/debug';

debugLog.info('User profile updated', {
  service: 'customer-profile',
  operation: 'update',
  userId: user.id
});

// Production system monitoring (always on)
import { systemLogger } from '@/shared/utils/system/system-logger';

systemLogger.security('warn', 'Rate limit exceeded', 'rate-limiting', {
  ip: '192.168.1.1',
  pathname: '/api/auth/login'
});

systemLogger.lifecycle('info', 'Application initialized', 'init');
```

---

## DebugLogger Implementation

### Core Logger Class

**Location:** `project/shared/utils/debug/debug.ts`

```typescript
import { sanitizeObject, sanitizeString } from '../security/pii-sanitization';
import { DEBUG_ENABLED, LOG_LEVEL } from '../config/envUtil';

// Log level hierarchy
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4, // Always shown
  timezone: 0,
} as const;

type LogLevel = "info" | "warn" | "error" | "debug" | "timezone" | "critical";

interface DebugContext {
  component?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  service?: string;
  operation?: string;
  [key: string]: any;
}

class DebugLogger {
  private enabled: boolean;
  
  constructor(enabled: boolean = DEBUG_ENABLED) {
    this.enabled = enabled;
  }

  private formatMessage(level: LogLevel, message: string, context?: DebugContext, data?: any): void {
    // Always emit errors regardless of enabled state
    if (!this.enabled && level !== 'error') return;

    // Check if log level should be printed
    const currentLogLevel = getLogLevel();
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel] && level !== 'error') return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Skip sanitization for error logs to preserve critical debugging info
    const shouldSanitize = level !== 'error';
    const sanitizedMessage = shouldSanitize ? sanitizeString(`${prefix} ${message}`) : `${prefix} ${message}`;
    const sanitizedContext = shouldSanitize && context ? sanitizeObject(context) : context;
    const sanitizedData = shouldSanitize && data ? sanitizeObject(data) : data;

    let logMessage = sanitizedMessage;

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      logMessage += ` | ${contextStr}`;
    }

    const logMethod = level === "error" ? console.error :
                     level === "warn" ? console.warn :
                     console.log;

    if (sanitizedData !== undefined) {
      logMethod(logMessage, sanitizedData);
    } else {
      logMethod(logMessage);
    }
  }

  info(message: string, context?: DebugContext, data?: any) {
    this.formatMessage('info', message, context, data);
  }

  warn(message: string, context?: DebugContext, data?: any) {
    this.formatMessage('warn', message, context, data);
  }

  error(message: string, context?: DebugContext, data?: any) {
    this.formatMessage('error', message, context, data);
  }

  debug(message: string, context?: DebugContext, data?: any) {
    this.formatMessage('debug', message, context, data);
  }
}

// Export singleton instance
export const debugLog = new DebugLogger();
export default debugLog;
```

---

## SystemLogger Implementation

### Production-Focused Logging

**Location:** `project/shared/utils/system/system-logger.ts`

The SystemLogger is designed for **always-on production monitoring** and bypasses all debug/development filters. It's used for:
- System health monitoring
- Security events (authentication, rate limiting, IP blocking)
- Infrastructure alerts (memory, Redis, database)
- Critical system events

### Core SystemLogger Class

```typescript
import { sanitizeObject, sanitizeString } from '@/shared/utils/security/pii-sanitization';

type SystemLogLevel = "info" | "warn" | "error" | "critical";

interface SystemContext {
  service: string;
  operation: string;
  [key: string]: any;
}

class SystemLogger {
  // Security events (authentication, rate limiting, IP blocking)
  security(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any
  ) {
    this.formatSystemMessage(level, message, {
      service: 'security',
      operation,
      ...data
    });
  }

  // System lifecycle events (startup, shutdown, initialization)
  lifecycle(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any
  ) {
    this.formatSystemMessage(level, message, {
      service: 'lifecycle',
      operation,
      ...data
    });
  }

  // Memory monitoring alerts
  memory(
    message: string,
    operation: string,
    data?: any
  ) {
    this.formatSystemMessage('warn', message, {
      service: 'memory',
      operation,
      ...data
    });
  }

  // Redis health monitoring
  redis(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any
  ) {
    this.formatSystemMessage(level, message, {
      service: 'redis',
      operation,
      ...data
    });
  }

  // Rate limiting events
  rateLimit(
    message: string,
    operation: string,
    data?: any
  ) {
    this.formatSystemMessage('warn', message, {
      service: 'rate-limit',
      operation,
      ...data
    });
  }

  private formatSystemMessage(
    level: SystemLogLevel,
    message: string,
    context: SystemContext,
    data?: any
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Add critical emoji for critical logs
    const finalMessage = level === "critical" ? `🚨 ${message}` : message;

    // Always sanitize for PII
    const sanitizedMessage = sanitizeString(`${prefix} ${finalMessage}`);
    const sanitizedContext = sanitizeObject(context);
    const sanitizedData = data ? sanitizeObject(data) : undefined;

    let logMessage = sanitizedMessage;

    // Format context as key=value pairs
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      logMessage += ` | ${contextStr}`;
    }

    const logMethod = level === "error" || level === "critical" ? console.error :
                     level === "warn" ? console.warn :
                     console.log;

    if (sanitizedData !== undefined) {
      logMethod(logMessage, sanitizedData);
    } else {
      logMethod(logMessage);
    }
  }
}

// Export singleton instance
export const systemLogger = new SystemLogger();
```

### SystemLogger Usage Examples

```typescript
import { systemLogger } from '@/shared/utils/system/system-logger';

// Security events
systemLogger.security('warn', 'Rate limit exceeded', 'rate-limiting', {
  ip: '192.168.1.1',
  pathname: '/api/auth/login',
  limitType: 'auth'
});

systemLogger.security('error', 'Blocked IP attempted access', 'ip-blocking', {
  blockedIp: '192.168.1.1',
  source: 'x-forwarded-for',
  pathway: '/api/admin/customers'
});

// Lifecycle events
systemLogger.lifecycle('info', 'Application initialized', 'init');
systemLogger.lifecycle('critical', 'Failed to initialize application', 'init', error);

// Memory monitoring
systemLogger.memory('High memory usage detected', 'check', {
  heapUsedMB: 1200,
  rssMB: 2500,
  alertCooldownMinutes: 5
});

// Redis health
systemLogger.redis('warn', 'Redis connection issues detected', 'health-check', {
  status: 'disconnected',
  error: 'Connection timeout'
});

systemLogger.redis('warn', 'High Redis latency detected', 'latency-check', {
  pingTime: 150
});

// Rate limiting
systemLogger.rateLimit('Rate limit exceeded', 'applyRateLimit', {
  rateLimitKey: 'ip:192.168.1.1',
  ip: '192.168.1.1',
  pathname: '/api/auth/login',
  limitType: 'auth'
});
```

### Key Differences: DebugLogger vs SystemLogger

| Feature | DebugLogger | SystemLogger |
|---------|------------|--------------|
| **Purpose** | Development/debugging | Production monitoring |
| **Can be disabled** | Yes (via `DEBUG_ENABLED`) | No (always runs) |
| **Log levels** | debug, info, warn, error, critical | info, warn, error, critical |
| **Use cases** | Feature logging, API calls, user actions | Security, infrastructure, system health |
| **PII sanitization** | Yes (except errors) | Always |
| **Specialized methods** | apiCall, logTimeConversion, componentLifecycle | security, lifecycle, memory, redis, rateLimit |

---

## Log Levels & Filtering

### Environment Configuration

```bash
# .env
DEBUG_ENABLED=true
NEXT_PUBLIC_LOG_LEVEL=debug  # debug | info | warn | error
```

### Log Level Hierarchy

```typescript
debug: 0    // Most verbose
info: 1     // General information
warn: 2     // Warning conditions
error: 3    // Error conditions
critical: 4 // Always shown (bypasses all filters)
```

### Runtime Control

```typescript
import { debugLog, setDebugEnabled } from '@/shared/utils/debug';

// Disable logging at runtime (e.g., in tests)
setDebugEnabled(false);

// Check if debug is enabled
if (debugLog.isEnabled()) {
  // Perform expensive logging operations
}
```

---

## Structured Logging

### Basic Usage

```typescript
debugLog.info('User profile updated', {
  service: 'customer-profile',
  operation: 'update',
  userId: user.id
});

// Output:
// [2025-12-03T10:30:45.123Z] [INFO] User profile updated | service=customer-profile operation=update userId=abc123
```

### With Context Data

```typescript
debugLog.info('Processing profile update', {
  service: 'customer-profile',
  operation: 'PUT'
}, {
  fieldsUpdated: ['name', 'email'],
  previousEmail: 'old@example.com',
  newEmail: 'new@example.com'
});

// Output includes context object in expanded format
```

---

## PII Sanitization

### Automatic PII Redaction

The logger automatically sanitizes PII from logs (except error logs for debugging):

```typescript
debugLog.info('User logged in', {
  email: 'user@example.com',
  password: 'not-a-real-password-example',
  creditCard: '4532-1234-5678-9010'
});

// Output (sanitized):
// [INFO] User logged in | email=[REDACTED] password=[REDACTED] creditCard=[REDACTED]
```

### PII Sanitization Implementation

**Location:** `project/shared/utils/security/pii-sanitization.ts`

```typescript
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
};

const SENSITIVE_FIELD_NAMES = [
  'password', 'token', 'apiKey', 'secret', 'authorization',
  'creditCard', 'cvv', 'ssn', 'dob', 'pin'
];

export function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Redact sensitive fields
    if (SENSITIVE_FIELD_NAMES.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeString(str: string): string {
  let sanitized = str;
  for (const [name, pattern] of Object.entries(PII_PATTERNS)) {
    sanitized = sanitized.replace(pattern, `[${name.toUpperCase()}_REDACTED]`);
  }
  return sanitized;
}
```

---

## Specialized Logging Helpers

### 1. API Call Logging

```typescript
debugLog.apiCall(
  'POST',
  '/api/customer/profile',
  'start',
  { userId: user.id }
);

// ... perform API call ...

debugLog.apiCall(
  'POST',
  '/api/customer/profile',
  'success',
  { userId: user.id, duration: '250ms' },
  { fieldsUpdated: 2 }
);
```

**Implementation:**

```typescript
class DebugLogger {
  apiCall(
    method: string,
    url: string,
    status: 'start' | 'success' | 'error',
    context?: DebugContext,
    data?: any
  ) {
    const level = status === 'error' ? 'error' : status === 'success' ? 'info' : 'debug';
    this.formatMessage(
      level as LogLevel,
      `API ${method} ${url} - ${status}`,
      { api: `${method} ${url}`, ...context },
      data
    );
  }
}

// Exported helper
export const logApiCall = (method, url, status, context?, data?) => 
  debugLog.apiCall(method, url, status, context, data);
```

### 2. Time Conversion Logging (Timezone Debugging)

```typescript
debugLog.logTimeConversion(
  'Fetched appointment',
  '2025-12-03T10:00:00Z',
  '2025-12-03T05:00:00-05:00',
  'America/New_York',
  { service: 'scheduling' }
);

// Output:
// 🕐 Fetched appointment: 2025-12-03T10:00:00Z -> 2025-12-03T05:00:00-05:00 (America/New_York)
// { original: ..., converted: ..., timezone: 'America/New_York', userTimezone: 'America/Los_Angeles', ... }
```

**Implementation:**

```typescript
class DebugLogger {
  logTimeConversion(
    operation: string,
    originalTime: string | Date,
    convertedTime: string | Date,
    timezone?: string,
    context?: DebugContext
  ) {
    const timezoneInfo = timezone ? ` (${timezone})` : '';
    this.timezone(
      `${operation}: ${originalTime} -> ${convertedTime}${timezoneInfo}`,
      context,
      {
        original: originalTime,
        converted: convertedTime,
        timezone,
        userTimezone: this.getUserTimezone(),
        timezoneOffset: this.getTimezoneOffset()
      }
    );
  }

  private getUserTimezone(): string {
    return typeof Intl !== 'undefined' ? 
      Intl.DateTimeFormat().resolvedOptions().timeZone : 'Unknown';
  }
}
```

### 3. Component Lifecycle Logging

```typescript
debugLog.componentLifecycle(
  'UserProfile',
  'mounted',
  { userId: '123' },
  { component: 'UserProfile' }
);

debugLog.componentLifecycle(
  'UserProfile',
  'updated',
  { changes: ['name', 'email'] }
);

// Output:
// [DEBUG] Component UserProfile - mounted | component=UserProfile
// [DEBUG] Component UserProfile - updated
```

### 4. Grouped Logs

```typescript
debugLog.group('Order Processing', () => {
  debugLog.info('Validating order items');
  debugLog.info('Calculating totals');
  debugLog.info('Creating Stripe session');
});

// Output:
// 🔍 Order Processing
//   [INFO] Validating order items
//   [INFO] Calculating totals
//   [INFO] Creating Stripe session
```

---

## Application Monitoring

### Global Error Handling & Health Checks

**Location:** `project/shared/utils/system/app-initialization.ts`

```typescript
import { debugLog } from '../debug';
import getRedisConnection from '@/shared/services/db/redis';

export function initializeApp() {
  // Install global error handlers
  installGlobalErrorHandlers();

  // Set up process monitoring
  setupProcessMonitoring();

  // Set up graceful shutdown
  setupGracefulShutdown();
}
```

### Process Monitoring (Memory & Redis)

```typescript
function setupProcessMonitoring() {
  const monitoringInterval = setInterval(async () => {
    // Memory monitoring
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Alert on high memory usage (over 1GB heap or 2GB RSS)
    if (heapUsedMB > 1024 || rssMB > 2048) {
      systemLogger.memory('High memory usage detected', 'check', {
        heapUsedMB,
        rssMB,
        alertCooldownMinutes: 5
      });
    }

    // Redis health check
    const redisHealth = await getRedisHealth();
    if (redisHealth.status === 'disconnected') {
      systemLogger.redis('warn', 'Redis connection issues detected', 'health-check', redisHealth);
    } else if (redisHealth.pingTime > 100) {
      systemLogger.redis('warn', 'High Redis latency detected', 'latency-check', {
        pingTime: redisHealth.pingTime
      });
    }
  }, 60000); // Check every minute
}
```

### Redis Health Check

```typescript
async function getRedisHealth() {
  try {
    const redis = getRedisConnection();

    const pingStart = Date.now();
    await redis.ping();
    const pingTime = Date.now() - pingStart;

    const info = await redis.info();
    // Parse memory, clients, keyspace metrics...

    return {
      status: 'connected',
      pingTime,
      metrics: { /* parsed metrics */ }
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message
    };
  }
}
```

### Application Health Endpoint

```typescript
// app/api/health/route.ts
import { getApplicationHealthDetailed } from '@/shared/utils/system/app-initialization';

export async function GET() {
  const health = await getApplicationHealthDetailed();
  
  return NextResponse.json({
    status: health.status,
    timestamp: health.timestamp,
    uptime: health.uptime,
    memory: health.memory,
    redis: health.redis,
    nodeVersion: health.nodeVersion
  });
}
```

---

## Database Performance Monitoring

### Query Performance Tracking

**Location:** `project/shared/services/db/performance-monitor.ts`

The Database Performance Monitor tracks query performance and connection pool health to prevent database performance degradation.

### Implementation

```typescript
import { PrismaClient, Prisma } from '@/infrastructure/database/lib/generated/prisma';
import debugLog from '@/shared/utils/debug';
import { sanitizeObject } from '@/shared/utils/security/pii-sanitization';

interface QueryMetrics {
  model: string;
  operation: string;
  duration: number;
  timestamp: Date;
  args?: any;
}

interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  timestamp: Date;
}

class DatabasePerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics: ConnectionPoolMetrics[] = [];
  private readonly maxMetricsHistory = 1000;

  private readonly thresholds: PerformanceThresholds = {
    slowQueryThreshold: 100, // 100ms
    connectionPoolWarningThreshold: 80, // 80% of pool
    connectionPoolCriticalThreshold: 95, // 95% of pool
  };

  constructor(private prisma: PrismaClient) {
    this.setupQueryMonitoring();
    this.startConnectionPoolMonitoring();
  }

  private setupQueryMonitoring() {
    // Intercept Prisma queries
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Track query metrics
        this.recordQuery({
          model: params.model || 'unknown',
          operation: params.action,
          duration,
          timestamp: new Date(),
          args: this.sanitizeArgs(params.args)
        });

        // Alert on slow queries
        if (duration > this.thresholds.slowQueryThreshold) {
          debugLog.warn('Slow database query detected', {
            service: 'database',
            operation: 'query',
            model: params.model,
            action: params.action,
            duration: `${duration}ms`
          }, {
            threshold: `${this.thresholds.slowQueryThreshold}ms`,
            args: this.sanitizeArgs(params.args)
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        debugLog.error('Database query failed', {
          service: 'database',
          operation: 'query',
          model: params.model,
          action: params.action,
          duration: `${duration}ms`
        }, error);

        throw error;
      }
    });
  }

  private startConnectionPoolMonitoring() {
    setInterval(async () => {
      try {
        const poolStatus = await this.getConnectionPoolStatus();
        this.recordConnectionMetrics(poolStatus);

        // Alert on high connection pool usage
        const usagePercent = (poolStatus.activeConnections / poolStatus.totalConnections) * 100;
        
        if (usagePercent >= this.thresholds.connectionPoolCriticalThreshold) {
          systemLogger.lifecycle('critical', 'Database connection pool critical', 'pool-monitor', {
            usagePercent: Math.round(usagePercent),
            activeConnections: poolStatus.activeConnections,
            totalConnections: poolStatus.totalConnections
          });
        } else if (usagePercent >= this.thresholds.connectionPoolWarningThreshold) {
          systemLogger.lifecycle('warn', 'Database connection pool warning', 'pool-monitor', {
            usagePercent: Math.round(usagePercent),
            activeConnections: poolStatus.activeConnections,
            totalConnections: poolStatus.totalConnections
          });
        }
      } catch (error) {
        debugLog.error('Failed to monitor connection pool', {
          service: 'database',
          operation: 'pool-monitor'
        }, error);
      }
    }, 60000); // Check every minute
  }

  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.queryMetrics
      .filter(q => q.duration > this.thresholds.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getQueryStats() {
    const recent = this.queryMetrics.slice(-100);
    return {
      total: recent.length,
      averageDuration: recent.reduce((sum, q) => sum + q.duration, 0) / recent.length,
      slowQueries: recent.filter(q => q.duration > this.thresholds.slowQueryThreshold).length,
      byModel: this.groupByModel(recent),
      byOperation: this.groupByOperation(recent)
    };
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive data from query args
    return sanitizeObject(args);
  }
}

// Usage
const monitor = new DatabasePerformanceMonitor(prisma);

// Get slow queries
const slowQueries = monitor.getSlowQueries(10);

// Get query statistics
const stats = monitor.getQueryStats();
```

### Performance Thresholds

- **Slow Query Threshold**: 100ms (queries taking longer trigger warnings)
- **Connection Pool Warning**: 80% usage
- **Connection Pool Critical**: 95% usage

### Monitoring Best Practices

1. **Track all queries** - Monitor every database operation
2. **Alert on slow queries** - Identify performance bottlenecks early
3. **Monitor connection pool** - Prevent connection exhaustion
4. **Sanitize query args** - Remove PII from logged query parameters
5. **Maintain metrics history** - Keep recent metrics for analysis

---

## Real Project Examples

### 1. API Route Logging (Customer Profile)

**Location:** `project/app/api/customer/profile/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Fetch user profile from database
    const profile = await prisma.user.findUnique({
      where: { firebaseUid: user.firebaseUser.uid }
    });

    return NextResponse.json({
      success: true,
      data: { user: profile }
    });
  } catch (error) {
    debugLog.error('Failed to fetch customer profile', {
      service: 'profile',
      operation: 'GET'
    }, error);

    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const body = await request.json();

  debugLog.info('Processing profile update', {
    service: 'customer-profile',
    operation: 'PUT',
    userId: user.userId
  }, {
    fieldsProvided: Object.keys(body)
  });

  // ... validation and update logic ...

  debugLog.info('Profile updated successfully', {
    service: 'customer-profile',
    operation: 'PUT',
    userId: user.userId,
    duration: `${Date.now() - startTime}ms`
  });

  return NextResponse.json({ success: true, data: { user: updatedUser } });
}
```

### 2. Stripe Payment Logging

**Location:** `project/features/payments/services/stripe-checkout.ts`

```typescript
export async function createStripeCheckoutSession(params: CreateCheckoutParams) {
  try {
    debugLog.info('Creating Stripe checkout session', {
      service: 'stripe-checkout',
      operation: 'createSession',
      type: params.type
    }, {
      userId: params.userId,
      itemCount: params.type === 'order' ? params.orderItems?.length : 1
    });

    const session = await stripe.checkout.sessions.create({
      mode: params.type === 'subscription' ? 'subscription' : 'payment',
      // ... session config ...
    });

    debugLog.info('Stripe session created successfully', {
      service: 'stripe-checkout',
      operation: 'createSession',
      sessionId: session.id
    });

    return { sessionId: session.id, url: session.url };
  } catch (error) {
    debugLog.error('Failed to create Stripe checkout session', {
      service: 'stripe-checkout',
      operation: 'createSession',
      type: params.type
    }, error);

    throw error;
  }
}
```

### 3. Admin Dashboard Logging

**Location:** `project/features/admin/components/dashboard/dashboard-view.tsx`

```typescript
const fetchData = async (url: string, serviceName: string) => {
  try {
    const response = await authenticatedFetchJson(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${serviceName}`);
    }

    const json = await response.json();

    debugLog.info(`Successfully fetched ${serviceName} data`, {
      service: 'admin-dashboard',
      operation: 'fetchData',
      endpoint: url
    });

    return json.data || json;
  } catch (error) {
    debugLog.error(`Failed to fetch ${serviceName} data`, {
      service: 'admin-dashboard',
      operation: 'fetchData',
      endpoint: url
    }, error);

    throw error;
  }
};
```

---

## Best Practices

### 1. Use Structured Context

```typescript
// ✅ GOOD: Structured context
debugLog.info('Order created', {
  service: 'orders',
  operation: 'create',
  orderId: order.id,
  userId: user.id
});

// ❌ BAD: Unstructured message
debugLog.info(`Order ${order.id} created for user ${user.id}`);
```

### 2. Never Log Sensitive Data

```typescript
// ✅ GOOD: Omit sensitive fields
debugLog.info('User authenticated', {
  userId: user.id,
  email: user.email // Will be sanitized automatically
});

// ❌ BAD: Logging passwords or tokens
debugLog.info('Login attempt', {
  email: email,
  password: password // DON'T DO THIS (even with sanitization)
});
```

### 3. Use Appropriate Log Levels

```typescript
// DEBUG: Detailed debugging information
debugLog.debug('Parsing request body', { bodyLength: body.length });

// INFO: General information
debugLog.info('User logged in', { userId: user.id });

// WARN: Warning conditions
debugLog.warn('Rate limit approaching', { requests: 90, limit: 100 });

// ERROR: Error conditions
debugLog.error('Database connection failed', { service: 'prisma' }, error);
```

### 4. Monitor Performance

```typescript
const startTime = Date.now();
const result = await expensiveOperation();
const duration = Date.now() - startTime;

if (duration > 1000) {
  debugLog.warn('Slow operation detected', {
    operation: 'expensiveOperation',
    duration: `${duration}ms`
  });
}
```

### 5. Group Related Logs

```typescript
debugLog.group('Payment Processing', () => {
  debugLog.info('Validating payment details');
  debugLog.info('Creating Stripe session');
  debugLog.info('Saving order to database');
});
```

### 6. Use Service + Operation Pattern

```typescript
// Consistent pattern for all logs
debugLog.info('Action completed', {
  service: 'feature-name',     // What service/feature
  operation: 'specificAction', // What specific action
  ...additionalContext
});
```

---

## Integration with External Tools

### Sentry Error Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

debugLog.error('Payment failed', {
  service: 'stripe',
  operation: 'charge'
}, error);

// Also send to Sentry for tracking
Sentry.captureException(error, {
  tags: { service: 'stripe', operation: 'charge' }
});
```

### Custom Metrics (Datadog, New Relic)

```typescript
import { sendMetric } from '@/shared/services/metrics';

const startTime = Date.now();
await operation();
const duration = Date.now() - startTime;

// Log for debugging
debugLog.info('Operation completed', { duration: `${duration}ms` });

// Send metric to monitoring service
sendMetric('operation.duration', duration, {
  operation: 'createOrder',
  status: 'success'
});
```

---

## Troubleshooting

### Logs Not Appearing

1. Check `DEBUG_ENABLED` is set to `true`
2. Check `LOG_LEVEL` is not filtering out logs
3. Verify logs aren't being sanitized incorrectly

### Too Many Logs

1. Increase `LOG_LEVEL` from `debug` to `info` or `warn`
2. Use `debugLog.group()` to collapse related logs
3. Add conditional logging for expensive operations

### PII Appearing in Logs

1. Verify `pii-sanitization.ts` patterns are comprehensive
2. Add field names to `SENSITIVE_FIELD_NAMES` array
3. Test sanitization with sample data

---

## Metrics and Observability

Logging gives per-event visibility; **metrics** (counters, histograms, gauges) enable trend analysis and alerting—e.g. error spikes, latency percentiles, request rate.

### Implementation

The app exposes Prometheus-format metrics at `GET /api/metrics` (`project/app/api/metrics/route.ts`). Metrics are collected in `project/shared/services/observability/metrics.ts` using `prom-client`, and are instrumented from:

- **HTTP:** `withApiProtection` in `api-route-protection.ts` (request count, duration, status class per route).
- **Errors:** `global-error-handler.ts` (`errors_total` by category/severity, plus `unhandled_rejections_total` and `uncaught_exceptions_total`).
- **Database:** Prisma middleware in `prisma.ts` (`db_query_duration_seconds`, `db_connection_pool_*` gauges).

### Metrics Exposed

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, route, status_class | Total HTTP requests (status_class: 2xx, 4xx, 5xx) |
| `http_request_duration_seconds` | Histogram | method, route | Request latency |
| `errors_total` | Counter | category, severity | Reported errors (category/severity from global-error-handler) |
| `unhandled_rejections_total` | Counter | — | Unhandled promise rejections |
| `uncaught_exceptions_total` | Counter | — | Uncaught exceptions |
| `db_query_duration_seconds` | Histogram | model, operation, status | DB query duration (status: ok, error) |
| `db_connection_pool_active` | Gauge | — | Active DB connections |
| `db_connection_pool_idle` | Gauge | — | Idle DB connections |
| `db_connection_pool_max` | Gauge | — | Max pool size |
| `app_uptime_seconds` | Gauge | — | Process uptime |

Route labels are normalized (e.g. UUIDs → `:id`) to limit cardinality.

### Environment

- **`METRICS_ENABLED`** – Enable metrics collection and `/api/metrics`. Default: `true` in production, `false` in development. (`envUtil.ts`)
- **`METRICS_SECRET`** – Optional. When set, `GET /api/metrics` requires `Authorization: Bearer <METRICS_SECRET>`.

### Grafana Cloud (Hosted Collector)

To scrape with Grafana Cloud:

1. In Grafana Cloud Prometheus onboarding, choose **Collect and send** → **Custom setup options** → **Hosted Collector**.
2. Create a scrape job:
   - **Scrape Job URL:** `https://<your-app-domain>/api/metrics` (must be HTTPS and publicly reachable).
   - **Scrape interval:** e.g. every minute or 30s.
   - **Authentication:** Bearer token — paste the value of `METRICS_SECRET` (no "Bearer " prefix).
3. Grafana Cloud will scrape the endpoint; use the Prometheus data source to build dashboards and alerts (e.g. `rate(http_requests_total[5m])`, `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`, `rate(errors_total[5m])`).

If the app is not publicly reachable, use Grafana Alloy or another agent in your network to scrape and forward to Grafana Cloud.

---

## Related Documentation

- [Error Handling](./error-handling.md)
- [Performance Optimization](./performance-optimization.md)
- [Security Implementation](./security.md)

---

*Last Updated: February 2026*
