# Error Handling

## Overview

Comprehensive error handling strategies for client-side, server-side, and API routes with standardized error responses and global error handling.

**Key Strategies:**
- **API Error Wrapper** - Standardized error handling for all API routes
- **Global Error Handler** - Process-level error catching and monitoring
- Structured error responses
- Error boundaries (React)
- Try-catch patterns
- Logging and monitoring
- User-friendly error messages

---

## Table of Contents

1. [API Error Wrapper](#api-error-wrapper)
2. [Global Error Handler](#global-error-handler)
3. [Error Types](#error-types)
4. [API Error Handling](#api-error-handling)
5. [Client Error Handling](#client-error-handling)
6. [Error Boundaries](#error-boundaries)
7. [Logging](#logging)
8. [Best Practices](#best-practices)

---

## API Error Wrapper

### Standardized API Route Error Handling

**Location:** `project/shared/utils/error-handling/api-error-wrapper.ts`

The API Error Wrapper provides a standardized way to handle errors in all API routes, ensuring no unhandled promise rejections can crash the server.

### Implementation

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  reportError,
  withTimeout,
  ErrorCategory,
} from "./global-error-handler";
import debugLog from "@/shared/utils/debug/debug";

// Standard HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Standard error messages
export const ERROR_MESSAGES = {
  INTERNAL_ERROR: "An internal server error occurred",
  INVALID_REQUEST: "Invalid request data",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  METHOD_NOT_ALLOWED: "Method not allowed",
  RATE_LIMITED: "Rate limit exceeded",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  TIMEOUT: "Request timeout",
  DATABASE_ERROR: "Database operation failed",
  EXTERNAL_SERVICE_ERROR: "External service error",
} as const;

// API route handler type
type ApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with standardized error handling
 */
export function withApiErrorHandler(
  handler: ApiHandler,
  options?: {
    timeout?: number;
    category?: ErrorCategory;
  }
): ApiHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      // Apply timeout if specified
      const handlerPromise = handler(request, context);
      const timeout = options?.timeout || 30000; // 30 seconds default

      const result = await withTimeout(
        handlerPromise,
        timeout,
        options?.category || "api"
      );

      return result;
    } catch (error) {
      return handleApiError(error, options?.category);
    }
  };
}

/**
 * Handles API errors and returns standardized error response
 */
function handleApiError(
  error: unknown,
  category: ErrorCategory = "api"
): NextResponse {
  // Report error to monitoring
  reportError(error, {
    category,
    severity: "error",
  });

  // Handle specific error types
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.INVALID_REQUEST,
        message: error.message,
        details: error.errors,
      },
      { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.UNAUTHORIZED,
        message: error.message,
      },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.FORBIDDEN,
        message: error.message,
      },
      { status: HTTP_STATUS.FORBIDDEN }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.NOT_FOUND,
        message: error.message,
      },
      { status: HTTP_STATUS.NOT_FOUND }
    );
  }

  // Database errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    debugLog.error("Database error", {
      service: "database",
      operation: "query",
      code: error.code,
    }, error);

    return NextResponse.json(
      {
        error: ERROR_MESSAGES.DATABASE_ERROR,
        message: "Database operation failed",
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }

  // Timeout errors
  if (error instanceof TimeoutError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.TIMEOUT,
        message: "Request timeout",
      },
      { status: HTTP_STATUS.GATEWAY_TIMEOUT }
    );
  }

  // Generic error
  debugLog.error("Unhandled API error", {
    service: "api",
    operation: "error-handler",
    category,
  }, error);

  return NextResponse.json(
    {
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: "An unexpected error occurred",
    },
    { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
  );
}
```

### Usage

```typescript
// app/api/customer/profile/route.ts
import { withApiErrorHandler, HTTP_STATUS } from '@/shared/utils/error-handling/api-error-wrapper';
import { NextRequest, NextResponse } from 'next/server';

async function handler(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;
  const profile = await prisma.user.findUnique({
    where: { firebaseUid: user.firebaseUser.uid }
  });

  if (!profile) {
    throw new NotFoundError('User profile not found');
  }

  return NextResponse.json({
    success: true,
    data: { user: profile }
  });
}

// Wrap handler with error handling
export const GET = withApiErrorHandler(handler, {
  timeout: 10000, // 10 seconds
  category: 'api'
});
```

### Benefits

1. **Standardized Responses** - All errors return consistent JSON structure
2. **Automatic Logging** - Errors are automatically logged with context
3. **Timeout Protection** - Prevents hanging requests
4. **Error Reporting** - Errors are reported to monitoring services
5. **Type Safety** - TypeScript ensures proper error handling

---

## Global Error Handler

### Process-Level Error Catching

**Location:** `project/shared/utils/error-handling/global-error-handler.ts`

The Global Error Handler catches unhandled errors at the process level and provides error reporting and metrics.

### Implementation

```typescript
import { systemLogger } from '@/shared/utils/system/system-logger';

export type ErrorCategory = 
  | "api" 
  | "database" 
  | "auth" 
  | "payment" 
  | "external-service"
  | "unknown";

interface ErrorContext {
  category?: ErrorCategory;
  severity?: "low" | "medium" | "high" | "critical";
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Install global error handlers for uncaught exceptions and unhandled rejections
 */
export function installGlobalErrorHandlers() {
  // Catch uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    reportError(error, {
      category: "unknown",
      severity: "critical",
    });

    systemLogger.lifecycle(
      "critical",
      "Uncaught exception detected",
      "error-handler",
      {
        error: error.message,
        stack: error.stack,
      }
    );

    // Exit process after logging
    process.exit(1);
  });

  // Catch unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown, promise: Promise<any>) => {
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason));

    reportError(error, {
      category: "unknown",
      severity: "high",
    });

    systemLogger.lifecycle(
      "error",
      "Unhandled promise rejection detected",
      "error-handler",
      {
        error: error.message,
        stack: error.stack,
      }
    );
  });
}

/**
 * Report error to monitoring services
 */
export function reportError(
  error: Error,
  context: ErrorContext = {}
): void {
  // Log error
  debugLog.error("Error reported", {
    service: "error-handler",
    operation: "report",
    category: context.category || "unknown",
    severity: context.severity || "medium",
  }, error);

  // Send to external monitoring (Sentry, etc.)
  if (typeof window === "undefined") {
    // Server-side: Send to monitoring service
    // Sentry.captureException(error, { tags: context });
  }
}

/**
 * Wrap async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  category: ErrorCategory = "unknown"
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Get error metrics
 */
export function getErrorMetrics(): {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<string, number>;
} {
  // Return error metrics for monitoring
  return {
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {},
  };
}
```

### Initialization

```typescript
// app/layout.tsx or middleware.ts
import { initializeApp } from '@/shared/utils/system/app-initialization';

// Initialize global error handlers at app startup
initializeApp();
```

---

## Error Types

### Custom Error Classes

```typescript
// Base error
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific errors
export class ValidationError extends AppError {
  constructor(message: string, public errors?: Record<string, string>) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}
```

---

## API Error Handling

### Standard Error Response

```typescript
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

// Error handler
function handleApiError(error: unknown): NextResponse {
  // Log error
  debugLog.error('API error', {}, error);
  
  // Custom app errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }
  
  // Validation errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'VALIDATION_ERROR',
        details: error.errors,
      },
      { status: 422 }
    );
  }
  
  // Database errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
  }
  
  // Generic error
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## Client Error Handling

### Try-Catch with Fetch

```typescript
async function fetchUserData() {
  try {
    const response = await fetch('/api/user');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    toast.error('Failed to load user data');
    return null;
  }
}
```

### React Query Error Handling

```typescript
const { data, error, isError } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  retry: 3,
  onError: (error) => {
    toast.error(`Failed to load user: ${error.message}`);
  }
});

if (isError) {
  return <ErrorDisplay message={error.message} />;
}
```

---

## Error Boundaries

### React Error Boundary

```tsx
// components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Next.js Error Boundaries

```tsx
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// app/global-error.tsx (for root errors)
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

---

## Logging

### Structured Logging

```typescript
// utils/logger.ts
export const debugLog = {
  info(message: string, context?: Record<string, any>, data?: any) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, { ...context, data });
    }
  },
  
  warn(message: string, context?: Record<string, any>, data?: any) {
    console.warn(`[WARN] ${message}`, { ...context, data });
  },
  
  error(message: string, context?: Record<string, any>, error?: unknown) {
    console.error(`[ERROR] ${message}`, {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error
    });
  }
};
```

### Error Logging in Production

```typescript
// Send to monitoring service (e.g., Sentry)
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'user-profile',
    },
    extra: {
      userId: user.id,
    },
  });
  
  throw error;
}
```

---

## Best Practices

### 1. Never Expose Sensitive Info

```typescript
// ✅ CORRECT
return NextResponse.json(
  { error: 'Database error occurred' },
  { status: 500 }
);

// ❌ WRONG: Exposes DB details
return NextResponse.json(
  { error: `Connection to postgres://user:pass@host failed` },
  { status: 500 }
);
```

### 2. Log Errors with Context

```typescript
// ✅ CORRECT
debugLog.error('Failed to create order', {
  service: 'order-service',
  userId: user.id,
  action: 'createOrder'
}, error);

// ❌ WRONG: No context
console.error(error);
```

### 3. Provide User-Friendly Messages

```typescript
// ✅ CORRECT
throw new AppError('Please sign in to continue', 401);

// ❌ WRONG: Technical jargon
throw new AppError('JWT token verification failed: invalid signature', 401);
```

### 4. Always Clean Up Resources

```typescript
const connection = await getConnection();
try {
  await performOperation(connection);
} catch (error) {
  debugLog.error('Operation failed', {}, error);
  throw error;
} finally {
  await connection.close(); // Always clean up
}
```

---

## Related Documentation

- [Logging & Monitoring](./logging-monitoring.md)
- [API Architecture](./api-architecture.md)
- [Component Architecture](./component-architecture.md)

---

*Last Updated: December 2025*

