# API Architecture

## Overview

RESTful API design using Hono (running on Bun) with comprehensive multi-layer protection (CORS, rate limiting, CSRF, authentication).

**Key Features:**
- REST conventions (GET, POST, PUT, DELETE)
- Multi-layer protection middleware
- Rate limiting (Redis-backed)
- Authentication/authorization checks
- Standardized responses
- Pagination & filtering

---

## Table of Contents

1. [API Route Structure](#api-route-structure)
2. [Route Protection](#route-protection)
3. [Rate Limiting](#rate-limiting)
4. [HTTP Methods & Conventions](#http-methods--conventions)
5. [Request/Response Patterns](#requestresponse-patterns)
6. [Best Practices](#best-practices)

---

## API Route Structure

**Location:** `backend/src/routes/`

### Directory Organization

```
backend/src/routes/
├── admin.ts            # Admin-only endpoints
├── customer.ts         # Customer endpoints (profile, orders)
├── generation.ts       # AI content generation endpoints
├── health.ts           # Health check, liveness, readiness
├── metrics.ts          # Prometheus metrics
├── queue.ts            # Content queue management
├── reels.ts            # Reel discovery and analysis
├── stripe-webhook.ts   # Stripe webhook handler
├── subscriptions.ts    # Subscription status, checkout
└── users.ts            # User management
```

Routes are mounted at `/api/<resource>` in `backend/src/index.ts`.

### Route File Template (Hono)

```typescript
// backend/src/routes/resource.ts
import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware/protection'
import { prisma } from '../infrastructure/database/lib/generated/prisma'

const app = new Hono()

// Authenticated user endpoint
app.get('/', requireAuth, async (c) => {
  const user = c.get('user')
  const data = await prisma.resource.findMany({ where: { userId: user.id } })
  return c.json({ data })
})

// Authenticated mutation
app.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const created = await prisma.resource.create({ data: { ...body, userId: user.id } })
  return c.json({ data: created }, 201)
})

// Admin-only endpoint
app.get('/admin-stats', requireAdmin, async (c) => {
  const stats = await getStats()
  return c.json({ stats })
})

export default app
```

---

## Route Protection

**Location:** `backend/src/middleware/protection.ts`

### Protection Middleware

Hono middleware that verifies Firebase tokens and attaches user context:

### API Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Route
    participant Protection Middleware
    participant CORS Validator
    participant Rate Limiter
    participant CSRF Validator
    participant Auth Validator
    participant Route Handler
    participant Database

    Client->>API Route: HTTP Request
    API Route->>Protection Middleware: withApiProtection()
    
    Protection Middleware->>CORS Validator: validateCORS()
    alt CORS Invalid
        CORS Validator-->>Client: 403 Forbidden
    else CORS Valid
        CORS Validator->>Rate Limiter: applyRateLimit()
        alt Rate Limit Exceeded
            Rate Limiter-->>Client: 429 Too Many Requests
        else Rate Limit OK
            Rate Limiter->>CSRF Validator: validateCSRF()
            alt Mutation Request & Auth Required
                alt CSRF Invalid
                    CSRF Validator-->>Client: 403 Forbidden
                else CSRF Valid
                    CSRF Validator->>Auth Validator: validateAuth()
                end
            else GET Request or Public
                CSRF Validator->>Auth Validator: validateAuth()
            end
            
            alt Auth Required
                alt Auth Invalid
                    Auth Validator-->>Client: 401 Unauthorized
                else Auth Valid
                    Auth Validator->>Route Handler: Execute Handler
                end
            else Public Route
                Auth Validator->>Route Handler: Execute Handler
            end
            
            Route Handler->>Database: Query/Update
            Database-->>Route Handler: Data
            Route Handler->>Protection Middleware: Response
            Protection Middleware->>Protection Middleware: addSecurityHeaders()
            Protection Middleware-->>Client: 200 OK + Headers
        end
    end
```

```typescript
export function withApiProtection(
  handler: RouteHandler,
  options: ProtectionOptions = {}
) {
  return async function protectedHandler(request, context) {
    // 1. CORS Validation
    const corsResponse = validateCORS(request);
    if (corsResponse) return corsResponse;

    // 2. Rate Limiting
    if (!options.skipRateLimit) {
      const rateLimitResponse = await applyRateLimiting(request, options.rateLimitType);
      if (rateLimitResponse) return rateLimitResponse;
    }

    // 3. CSRF Protection (authenticated endpoints only)
    if (!options.skipCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const csrfResponse = await validateCSRF(request, pathname);
      if (csrfResponse) return csrfResponse;
    }

    // 4. Authentication
    if (options.requireAuth) {
      const authResponse = await validateAuth(request, options.requireAuth);
      if (authResponse) return authResponse;
    }

    // 5. Execute handler
    const response = await handler(request, context);

    // 6. Add security headers
    return addSecurityHeaders(response);
  };
}
```

### Protection Options

```typescript
interface ProtectionOptions {
  skipRateLimit?: boolean;         // Skip rate limiting
  skipCSRF?: boolean;              // Skip CSRF (use for public endpoints)
  rateLimitType?: RateLimitType;   // Override rate limit type
  requireAuth?: 'user' | 'admin' | false;  // Auth requirement
}
```

### Convenience Wrappers

```typescript
// User endpoints (authenticated users)
export const withUserProtection = (handler, options = {}) => 
  withApiProtection(handler, {
    ...options,
    requireAuth: 'user',
    rateLimitType: options.rateLimitType || 'customer',
  });

// Admin endpoints (admin only)
export const withAdminProtection = (handler, options = {}) =>
  withApiProtection(handler, {
    ...options,
    requireAuth: 'admin',
    rateLimitType: 'admin',
  });

// Public endpoints (no auth, skip CSRF)
export const withPublicProtection = (handler, options = {}) =>
  withApiProtection(handler, {
    ...options,
    skipCSRF: true,
    rateLimitType: options.rateLimitType || 'public',
  });
```

### Usage Example

```typescript
// Admin endpoint
export const GET = withAdminProtection(async (request) => {
  // Only admins can access
  const data = await getAdminData();
  return NextResponse.json({ data });
});

// Customer endpoint
export const GET = withUserProtection(async (request) => {
  // Any authenticated user can access
  const data = await getUserData();
  return NextResponse.json({ data });
});

// Public endpoint
export const POST = withPublicProtection(async (request) => {
  // No auth required, CSRF skipped
  const body = await request.json();
  await handlePublicSubmission(body);
  return NextResponse.json({ success: true });
}, {
  rateLimitType: 'contact', // Strict rate limit for contact forms
});
```

---

## Rate Limiting

**Location:** `backend/src/` rate limiting utilities. IP and identity for rate-limit keys come from the request identity service.

### Rate Limit Configurations

```typescript
export const RATE_LIMIT_CONFIGS = {
  auth: {
    window: 60,        // 1 minute
    maxRequests: 5,    // 5 requests per minute
    keyPrefix: "auth_rate_limit",
    description: "Authentication endpoints",
  },
  payment: {
    window: 3600,      // 1 hour
    maxRequests: 30,   // 30 requests per hour
    keyPrefix: "payment_rate_limit",
    description: "Payment/checkout endpoints",
  },
  admin: {
    window: 60,
    maxRequests: 30,
    keyPrefix: "admin_rate_limit",
    description: "Admin operations",
  },
  customer: {
    window: 60,
    maxRequests: 60,
    keyPrefix: "customer_rate_limit",
    description: "Customer endpoints",
  },
  public: {
    window: 60,
    maxRequests: 500,
    keyPrefix: "public_rate_limit",
    description: "Public API endpoints",
  },
  contact: {
    window: 300,       // 5 minutes
    maxRequests: 5,    // 5 submissions per 5 minutes
    keyPrefix: "contact_rate_limit",
    description: "Contact form submissions",
  },
  generation: {
    window: 86400,     // 24 hours
    maxRequests: 50,  // Per tier limits enforced server-side
    keyPrefix: "generation_rate_limit",
    description: "AI content generation",
  },
  analysis: {
    window: 86400,    // 24 hours
    maxRequests: 100, // Per tier limits enforced server-side
    keyPrefix: "analysis_rate_limit",
    description: "Reel analysis requests",
  },
};
```

### How Rate Limiting Works

```mermaid
sequenceDiagram
    participant Client
    participant API Route
    participant Rate Limiter
    participant Redis
    participant Route Handler

    Client->>API Route: HTTP Request
    API Route->>Rate Limiter: applyRateLimit()
    
    alt Has Authorization Header
        Rate Limiter->>Rate Limiter: Extract Firebase UID from JWT
        Rate Limiter->>Rate Limiter: Generate Key: "customer_rate_limit:user:{uid}"
    else No Authorization
        Rate Limiter->>Rate Limiter: Extract IP Address
        Rate Limiter->>Rate Limiter: Generate Key: "public_rate_limit:ip:{ip}"
    end
    
    Rate Limiter->>Redis: GET {key}
    Redis-->>Rate Limiter: Current Count
    
    alt Count >= maxRequests
        Rate Limiter->>Rate Limiter: Calculate Retry-After
        Rate Limiter-->>Client: 429 Too Many Requests<br/>+ Rate Limit Headers
    else Count < maxRequests
        Rate Limiter->>Redis: INCR {key}
        Rate Limiter->>Redis: EXPIRE {key} {window}
        Redis-->>Rate Limiter: OK
        Rate Limiter->>Route Handler: Allow Request
        Route Handler-->>Client: 200 OK + Rate Limit Headers
    end
```

**Steps:**
1. Extract identifier:
   - If Authorization header → Extract Firebase UID from JWT token
   - If no auth → Use IP address
   
2. Generate Redis key: {keyPrefix}:{identifier}
   - Authenticated: "customer_rate_limit:user:{firebaseUID}"
   - Unauthenticated: "public_rate_limit:ip:{ipAddress}"
   
3. Check current count in Redis
4. If count >= maxRequests: Return 429 Too Many Requests
5. Increment count (with TTL = window)
6. Allow request

**Key Points:**
- **No session IDs:** Removed entirely
- **Authenticated users:** Rate limiting uses Firebase UID (stable across token refreshes)
- **Unauthenticated users:** Rate limiting uses IP address
- **Token caching:** Firebase token verification cached for 55 minutes

### Response Headers

```typescript
// Rate limit headers (automatically added)
X-RateLimit-Limit: 60        // Max requests allowed
X-RateLimit-Remaining: 42     // Requests remaining
X-RateLimit-Reset: 1641234567 // Unix timestamp when limit resets
Retry-After: 45               // Seconds to wait before retrying
```

### IP Blocking

IP resolution and blocking live in `shared/services/request-identity` (not rate-limit logic). For checking a request against a blocked-IP list:

```typescript
import { checkIpBlocking } from '@/shared/services/request-identity';

const { shouldBlock, reason, securityInfo } = checkIpBlocking(request, blockedIps);

if (shouldBlock) {
  return NextResponse.json(
    { error: 'Access denied' },
    { status: 403 }
  );
}
```

---

## HTTP Methods & Conventions

### Method Usage

| Method | Purpose | Request Body | Response Status | Idempotent |
|--------|---------|--------------|-----------------|------------|
| GET | Retrieve resources | No | 200 | Yes |
| POST | Create resource | Yes | 201 | No |
| PUT | Update/Replace | Yes | 200 | Yes |
| PATCH | Partial update | Yes | 200 | No |
| DELETE | Remove resource | No | 204 or 200 | Yes |

### Status Codes

```typescript
200 OK                  // Successful GET, PUT, PATCH, DELETE
201 Created             // Successful POST (resource created)
204 No Content          // Successful DELETE (no body)
400 Bad Request         // Invalid input
401 Unauthorized        // Missing/invalid token
403 Forbidden           // Insufficient permissions
404 Not Found           // Resource doesn't exist
422 Unprocessable Entity // Validation failed
429 Too Many Requests   // Rate limit exceeded
500 Internal Server Error // Server error
```

---

## Request/Response Patterns

### Standard Success Response

```typescript
import { createSuccessResponse } from '@/shared/utils/api/response-helpers';

// Single resource
return createSuccessResponse({
  user: { id: '123', name: 'John' }
});

// List with pagination
return createSuccessResponse({
  users: [...],
  pagination: {
    currentPage: 1,
    totalPages: 10,
    totalCount: 95,
    hasMore: true,
  }
});
```

### Standard Error Response

```typescript
import { createBadRequestResponse, createInternalErrorResponse } from '@/shared/utils/api/response-helpers';

// Bad request (400)
return createBadRequestResponse('Email is required');

// Validation error (422)
return createBadRequestResponse('Validation failed', zodError.issues);

// Internal error (500)
return createInternalErrorResponse('Failed to process request', error);
```

### Pagination Query Parameters

```
GET /api/resource?page=1&limit=20&search=query&sortBy=createdAt&sortOrder=desc

page: Page number (1-based, default: 1)
limit: Records per page (max: 100, default: 20)
search: Search term
sortBy: Sort field
sortOrder: 'asc' or 'desc'
```

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 95,
    "limit": 20,
    "hasMore": true,
    "hasPrevious": false
  }
}
```

---

## Client-Side Fetch Utilities

**Location:** `frontend/src/shared/services/api/authenticated-fetch.ts`, `frontend/src/shared/hooks/use-query-fetcher.ts`, `frontend/src/shared/lib/query-keys.ts`

### React Query (TanStack Query)

For GET requests with caching, use React Query:

- **useQuery + useQueryFetcher:** Cached GET requests with auth, CSRF, and timezone headers. Use `queryKeys` from `@/shared/lib/query-keys` for consistent keys and invalidation.
- **Invalidation:** After mutations, call `queryClient.invalidateQueries({ queryKey })` or with a predicate. On logout, all API caches are cleared via `queryClient.removeQueries({ predicate })` in app-context.
- **Provider:** `QueryProvider` in layout wraps the app; DevTools in development.

Use `queryKeys` from `@/shared/lib/query-keys` for all cache keys to ensure consistent invalidation.

### Authenticated Fetch

For authenticated requests with automatic CSRF token handling:

```typescript
import { authenticatedFetch, authenticatedFetchJson } from '@/shared/services/api/authenticated-fetch';

// With automatic CSRF token for state-changing requests
const response = await authenticatedFetch('/api/customer/profile', {
  method: 'PUT',
  body: JSON.stringify({ name: 'John' }),
});

// JSON parsing with auto-unwrapping
const profile = await authenticatedFetchJson<UserProfile>('/api/customer/profile');
```

**Features:**
- ✅ Automatically includes Firebase JWT token in `Authorization` header
- ✅ Automatically adds CSRF token for POST/PUT/PATCH/DELETE requests
- ✅ Uses `safeFetch` internally (timeout, retry logic)
- ✅ Handles CSRF token invalidation and refresh
- ✅ Auto-unwraps standardized API responses (`{ data: ... }`)

### Public Fetch

For unauthenticated requests (no CSRF needed):

```typescript
import { publicFetch, publicFetchJson } from '@/shared/services/api/safe-fetch';

// Public endpoint (contact form, etc.)
const response = await publicFetch('/api/shared/contact-messages', {
  method: 'POST',
  body: JSON.stringify(formData),
});

// JSON parsing
const result = await publicFetchJson<ContactResponse>('/api/shared/contact-messages', {
  method: 'POST',
  body: JSON.stringify(formData),
});
```

**Features:**
- ✅ No authentication required
- ✅ No CSRF protection (not needed for public endpoints)
- ✅ Uses `safeFetch` internally (timeout, retry logic)
- ✅ Rate limiting uses IP address

### Safe Fetch

Base fetch utility with timeout and retry:

```typescript
import { safeFetch } from '@/shared/services/api/safe-fetch';

const response = await safeFetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  timeout: 10000,        // 10 seconds
  retryAttempts: 2,     // Retry twice on failure
  retryOn: (error) => { // Custom retry logic
    return error.message.includes('network');
  },
});
```

**When to Use:**
- ✅ Use `authenticatedFetch` for authenticated API calls
- ✅ Use `publicFetch` for unauthenticated API calls
- ✅ Use `safeFetch` directly only for external APIs or special cases

---

## Best Practices

### Security

- ✅ Always use protection wrappers (withUserProtection, withAdminProtection)
- ✅ Verify authentication server-side (never trust client)
- ✅ Validate all inputs with Zod schemas
- ✅ Sanitize error messages (no sensitive data)
- ✅ Use rate limiting on all endpoints
- ✅ Apply CSRF protection to mutations (POST/PUT/DELETE) for authenticated endpoints only
- ✅ CSRF tokens bound to Firebase UID (encrypted with AES-256-GCM)
- ✅ Rate limiting uses Firebase UID for authenticated users, IP for unauthenticated
- ✅ Use `authenticatedFetch` for authenticated requests (automatic CSRF)
- ✅ Use `publicFetch` for unauthenticated requests

### Performance

- ✅ Use pagination for list endpoints
- ✅ Implement caching where appropriate
- ✅ Optimize database queries (use indexes, select only needed fields)
- ✅ Return only necessary data

### Error Handling

- ✅ Return appropriate status codes
- ✅ Use standardized error response format
- ✅ Log errors server-side with context
- ✅ Don't expose stack traces in production

### API Design

- ✅ Use RESTful conventions
- ✅ Version APIs if breaking changes expected
- ✅ Document endpoints clearly
- ✅ Keep responses consistent across endpoints

---

## Related Documentation

- [Authentication](./authentication.md) - Auth, roles, sessions
- [Security](./security.md) - CSRF, CORS, PII sanitization
- [Error Handling](./error-handling.md) - Error patterns and logging
- [Database](./database.md) - Database patterns and validation
- [Studio System](../domain/studio-system.md) - ReelStudio-specific API patterns
- [Generation System](../domain/generation-system.md) - AI content generation APIs

---

*Last Updated: January 2026*
