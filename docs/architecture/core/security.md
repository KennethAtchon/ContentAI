# Security

## Overview

Comprehensive security implementation covering multiple attack vectors and protection mechanisms.

**Security Layers:**
- Authentication & Authorization (Firebase)
- CSRF Protection (token-based)
- CORS Configuration (origin validation)
- Rate Limiting (Redis-backed)
- Security Headers (CSP, HSTS, etc.)
- PII Sanitization (GDPR-compliant)
- Input Validation (Zod schemas)
- SQL Injection Prevention (Prisma ORM)
- XSS Protection (React + CSP)

---

## Table of Contents

1. [Security Headers](#security-headers)
2. [CSRF Protection](#csrf-protection)
3. [CORS Configuration](#cors-configuration)
4. [Rate Limiting](#rate-limiting)
5. [PII Sanitization](#pii-sanitization)
6. [Input Validation](#input-validation)
7. [SQL Injection Prevention](#sql-injection-prevention)
8. [XSS Protection](#xss-protection)
9. [Security Checklist](#security-checklist)

---

## Security Headers

**Location:** `backend/src/middleware/` (security headers applied in Hono middleware)

### Headers Configuration

```typescript
// Hono middleware pattern (backend/src/middleware/)
app.use('*', async (c, next) => {
  await next()
  // Content Security Policy - Prevent XSS
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "frame-src 'self' https://js.stripe.com",
    "connect-src 'self' https://api.stripe.com",
  ].join('; '))
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (IS_PRODUCTION) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')
})
```

---

## CSRF Protection

**Location:** `backend/src/` CSRF service

### How CSRF Works

CSRF attacks trick authenticated users into performing unwanted actions. Example: A malicious site submits a form to your bank while you're logged in, using your authentication token.

### Protection Mechanism

**Encrypted Token Model:**
1. **CSRF Token:** Encrypted token bound to Firebase UID (AES-256-GCM)
2. **Authentication:** Firebase JWT token in Authorization header
3. **No Session IDs:** Removed entirely - Firebase handles sessions

```typescript
// Generate token (server-side) - bound to Firebase UID
import { generateCSRFToken } from '@/shared/services/csrf/csrf-protection';
const token = generateCSRFToken(firebaseUID);

// Validate token (middleware) - validates against Firebase UID
import { requireCSRFToken } from '@/shared/services/csrf/csrf-protection';
const isValid = await requireCSRFToken(request, firebaseUID);

// Client-side usage (authenticated requests only)
import { authenticatedFetch } from '@/shared/services/api/authenticated-fetch';
const response = await authenticatedFetch('/api/resource', {
  method: 'POST',
  body: JSON.stringify(data),
  // CSRF token automatically added for state-changing requests
});
```

### Token Flow

```
1. Authenticated Client → GET /api/csrf (requires Firebase auth)
2. Server → Extracts Firebase UID from JWT token
3. Server → Generates encrypted CSRF token bound to Firebase UID
4. Server → Returns token in response body
5. Client → Stores token in memory (NOT localStorage, NOT cookies)
6. Client → POST /api/resource with:
   - Authorization: Bearer {firebaseToken}
   - X-CSRF-Token: {csrfToken}
7. Server → Validates Firebase token, extracts UID
8. Server → Validates CSRF token matches Firebase UID
9. Server → Processes request
```

### Token Encryption

CSRF tokens use **AES-256-GCM** encryption:
- **Payload:** `timestamp:random:firebaseUID`
- **Encryption:** AES-256-GCM with 96-bit IV
- **Format:** `base64url(iv:encrypted:authTag)`
- **Expiry:** 24 hours

### When CSRF is Required

- ✅ **Required:** POST, PUT, PATCH, DELETE requests to authenticated endpoints
- ✅ **Only for authenticated users:** Unauthenticated users don't need CSRF
- ⏭️ **Skipped:** GET, HEAD, OPTIONS requests
- ⏭️ **Skipped:** Public endpoints (contact forms, etc.)
- ⏭️ **Skipped:** Unauthenticated requests

### Unauthenticated Requests

Unauthenticated requests (public endpoints) don't require CSRF protection:
- No authentication = no CSRF risk
- Rate limiting uses IP address
- Use `publicFetch()` from `safe-fetch.ts`

---

## CORS Configuration

**Location:** `backend/src/middleware/protection.ts`

### Same-Origin Policy

Browsers prevent JavaScript from making requests to different origins (protocol + domain + port).

```
Same Origin:     https://myapp.com → https://myapp.com/api ✅
Different Origin: https://myapp.com → https://api.myapp.com ❌
```

### CORS Headers

```typescript
// Allowed origins configuration
const allowedOrigins = [
  'https://myapp.com',
  'https://www.myapp.com',
  'http://localhost:3000', // Development
];

// Validate and set CORS headers
function validateCORS(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { error: 'CORS: Origin not allowed' },
      { status: 403 }
    );
  }
  
  const response = NextResponse.next();
  
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  }
  
  return response;
}
```

### Preflight Requests

Browsers send OPTIONS preflight requests before certain requests (POST, PUT, DELETE with custom headers).

```typescript
// Handle OPTIONS preflight
if (request.method === 'OPTIONS') {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // Cache for 24 hours
    },
  });
}
```

---

## Rate Limiting

**Location:** `backend/src/` rate limiting service and config

### Rate Limit Key Strategy

**Authenticated Users:**
- Uses **Firebase UID** extracted from JWT token
- Key format: `user:{firebaseUID}`
- Stable across token refreshes (UID doesn't change)
- Token verification cached for 55 minutes

**Unauthenticated Users:**
- Uses **IP address**
- Key format: `ip:{ipAddress}`
- Fallback for requests without authentication

**No Session IDs:**
- Session IDs removed entirely
- Rate limiting uses Firebase UID or IP only

### Rate Limit Configurations

```typescript
export const RATE_LIMIT_CONFIGS = {
  auth: {
    window: 60,        // 1 minute
    maxRequests: 5,    // 5 requests per minute
    keyPrefix: "auth_rate_limit",
    description: "Authentication endpoints (login, signup)",
  },
  payment: {
    window: 3600,      // 1 hour
    maxRequests: 30,   // 30 requests per hour
    keyPrefix: "payment_rate_limit",
    description: "Payment and checkout endpoints",
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
    maxRequests: 5,
    keyPrefix: "contact_rate_limit",
    description: "Contact form submissions",
  },
};
```

### How Rate Limiting Works

```
1. Extract identifier:
   - If Authorization header present → Extract Firebase UID from JWT
   - If no auth → Use IP address
   
2. Generate Redis key: {keyPrefix}:{identifier}
   - Authenticated: "customer_rate_limit:user:abc123"
   - Unauthenticated: "public_rate_limit:ip:192.168.1.1"
   
3. Check current count in Redis
4. If count >= maxRequests: Return 429 Too Many Requests
5. Increment count (with TTL = window)
6. Allow request
```

### Usage in API Routes

Rate limiting is automatically applied via protection wrappers:

```typescript
import { withUserProtection } from '@/shared/middleware/api-route-protection';

export const POST = withUserProtection(async (request) => {
  // Rate limiting automatically applied
  // Uses Firebase UID for authenticated users
  // Uses IP for unauthenticated users
}, {
  rateLimitType: 'customer',
});
```

### Response Headers

```typescript
// Rate limit headers (automatically added)
X-RateLimit-Limit: 60        // Max requests allowed
X-RateLimit-Remaining: 42     // Requests remaining
X-RateLimit-Reset: 1641234567 // Unix timestamp when limit resets
Retry-After: 45               // Seconds to wait before retrying
```

---

## PII Sanitization

**Location:** `backend/src/utils/security/pii-sanitization.ts`

### GDPR-Compliant Data Protection

Automatically detects and sanitizes Personally Identifiable Information (PII) in logs, API responses, and error messages.

### Implementation

```typescript
import { sanitizeObject, sanitizeString } from '@/shared/utils/security/pii-sanitization';

// Sanitize object (automatic field detection)
const userData = {
  email: "user@example.com",
  phone: "555-123-4567",
  password: "not-a-real-password-example",
  creditCard: "4532-1234-5678-9010"
};

const sanitized = sanitizeObject(userData);
// Result: All sensitive fields → "[REDACTED]"

// Sanitize string (pattern matching)
const logMessage = "User john@example.com called from 555-123-4567";
const sanitizedMessage = sanitizeString(logMessage);
// Result: "User [EMAIL_REDACTED] called from [PHONE_REDACTED]"
```

### Sensitive Field Patterns

Automatically redacts fields containing:
- Emails, phone numbers, addresses
- Passwords, tokens, API keys
- SSN, credit cards, CVV
- Names, dates of birth
- IP addresses

### Integration with Loggers

Both DebugLogger and SystemLogger automatically sanitize PII:

```typescript
import debugLog from '@/shared/utils/debug';

// Automatically sanitized
debugLog.info('User logged in', {
  email: 'user@example.com', // Will be redacted
  phone: '555-123-4567'      // Will be redacted
});
```

---

## Input Validation

**Location:** `shared/utils/validation/`, `shared/middleware/api-route-protection.ts`

### Automatic Validation in API Route Protection

Input validation is now integrated into the API route protection middleware, providing automatic XSS protection by sanitizing and validating all user input before it reaches your handlers.

**Benefits:**
- ✅ **Automatic validation** - No need to manually validate in each route
- ✅ **XSS protection** - Zod schemas sanitize and validate input
- ✅ **Consistent error responses** - Standardized 422 validation errors
- ✅ **Type safety** - TypeScript types inferred from schemas
- ✅ **Early rejection** - Invalid requests rejected before handler execution

### Using Validation in API Routes

```typescript
import { z } from 'zod';
import { withUserProtection } from '@/shared/middleware/api-route-protection';

// Define validation schema
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255),
  phone: z.string().regex(/^[\+]?[\d\s\-\.\(\)]+$/).optional(),
});

// Query parameter validation
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
});

async function putHandler(request: NextRequest) {
  // Body is already validated - safe to use
  const body = await request.json();
  // body is type-safe and validated
  
  // Your handler logic here...
}

// Apply validation automatically
export const PUT = withUserProtection(putHandler, {
  bodySchema: updateProfileSchema, // Validates request body
  rateLimitType: "customer",
});

// GET with query validation
export const GET = withUserProtection(getHandler, {
  querySchema: paginationSchema, // Validates query parameters
  rateLimitType: "customer",
});
```

### Manual Validation (Alternative)

If you need more control, you can still validate manually:

```typescript
import { z } from 'zod';
import { validateInput } from '@/shared/utils/validation/api-validation';

// Define schema
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
});

// Validate input manually
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const result = validateInput(createUserSchema, body, 'POST /api/users');
  
  if (!result.success) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        message: result.error,
        details: result.details
      },
      { status: 422 }
    );
  }
  
  const validData = result.data; // Type-safe
  // Use validData...
}
```

### Validation Schemas

Pre-built schemas available:
- `shared/utils/validation/auth-validation.ts` - Authentication forms
- `shared/utils/validation/api-validation.ts` - API inputs
- `shared/utils/validation/contact-validation.ts` - Contact forms
- `shared/utils/validation/search-validation.ts` - Search queries
- `shared/utils/validation/checkout-validation.ts` - Checkout/payment forms
- `shared/utils/validation/file-validation.ts` - File uploads

### XSS Protection Through Validation

Zod schemas automatically protect against XSS by:
- **Type coercion** - Converts strings to expected types
- **Sanitization** - `.trim()`, `.transform()` remove dangerous characters
- **Length limits** - Prevents buffer overflow attacks
- **Pattern matching** - Regex validation prevents injection
- **Structured validation** - Only allows expected data shapes

**Example:**
```typescript
const safeStringSchema = z.string()
  .trim() // Remove whitespace
  .max(1000) // Prevent large payloads
  .regex(/^[a-zA-Z0-9\s.,!?]+$/) // Only allow safe characters
  .transform(val => val.replace(/<script>/gi, '')); // Remove script tags
```

---

## SQL Injection Prevention

### Prisma ORM (Parameterized Queries)

```typescript
// ✅ CORRECT: Prisma automatically prevents SQL injection
const user = await prisma.user.findUnique({
  where: { email: userInput }  // Automatically escaped
});

// ✅ CORRECT: Raw queries with parameterization
const results = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userInput}
`;

// ❌ WRONG: Never use string interpolation
const query = `SELECT * FROM users WHERE email = '${userInput}'`; // DON'T DO THIS
```

**Key Points:**
- Always use Prisma's query API or parameterized raw queries
- Never concatenate user input into SQL strings
- Prisma automatically escapes all parameters

---

## XSS Protection

### React Auto-Escaping

```typescript
// ✅ Safe: React automatically escapes
<div>{userInput}</div>

// ⚠️ Dangerous: Only use with trusted content
<div dangerouslySetInnerHTML={{ __html: trustedHtml }} />

// ✅ Sanitize before using dangerouslySetInnerHTML
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

### Content Security Policy

CSP headers prevent inline scripts:

```typescript
// Only allow scripts from same origin
"script-src 'self'"

// No eval() or inline scripts
"script-src 'self' 'unsafe-eval'"  // ❌ Avoid 'unsafe-eval'
```

---

## Security Checklist

### Authentication & Authorization
- [x] Firebase Auth implemented
- [x] Server-side token verification on all protected routes
- [x] Custom claims for roles (admin/user)
- [x] Admin verification enforced
- [x] No session IDs (Firebase handles sessions)

### API Security
- [x] CSRF protection on mutations (POST/PUT/DELETE)
- [x] Rate limiting on all endpoints
- [x] CORS properly configured (allowed origins only)
- [x] Input validation with Zod schemas
- [x] Proper error handling (no sensitive data leaked)

### Security Headers
- [x] Content Security Policy configured
- [x] X-Frame-Options set to DENY
- [x] X-Content-Type-Options set to nosniff
- [x] HSTS enabled in production
- [x] Permissions Policy configured

### Data Protection
- [x] Sensitive data encrypted at rest (Neon)
- [x] HTTPS enforced in production
- [x] Environment variables secured (.env.local)
- [x] No secrets in code
- [x] PII sanitization in logs (automatic)

### Database
- [x] Prisma ORM used (prevents SQL injection)
- [x] Parameterized queries only
- [x] Connection pooling configured
- [x] Database credentials secured

### Client-Side
- [x] React escapes output by default
- [x] DOMPurify for user-generated HTML
- [x] No eval() or Function() with user input
- [x] CSRF tokens stored in memory only (not localStorage, not cookies)
- [x] Firebase tokens in memory (not localStorage)

---

## Related Documentation

- [Authentication System](./authentication.md) - Firebase auth, roles, session management
- [API Architecture](./api.md) - API routes, protection, rate limiting
- [Error Handling](./error-handling.md) - Error handling and logging

---

---

## Fetch Utilities

**Location:** `shared/services/api/authenticated-fetch.ts`, `shared/services/api/safe-fetch.ts`

### Authenticated Requests

```typescript
import { authenticatedFetch, authenticatedFetchJson } from '@/shared/services/api/authenticated-fetch';

// Automatically includes:
// - Authorization: Bearer {firebaseToken}
// - X-CSRF-Token: {csrfToken} (for POST/PUT/PATCH/DELETE)
const response = await authenticatedFetch('/api/customer/profile', {
  method: 'PUT',
  body: JSON.stringify({ name: 'John' }),
});
```

### Unauthenticated Requests

```typescript
import { publicFetch, publicFetchJson } from '@/shared/services/api/safe-fetch';

// No authentication, no CSRF (public endpoints)
const response = await publicFetch('/api/shared/contact-messages', {
  method: 'POST',
  body: JSON.stringify(formData),
});
```

**Key Points:**
- ✅ Never use plain `fetch()` for API calls
- ✅ Use `authenticatedFetch` for authenticated requests
- ✅ Use `publicFetch` for unauthenticated requests
- ✅ All fetch utilities use `safeFetch` internally (timeout, retry)

---

*Last Updated: January 2026*
