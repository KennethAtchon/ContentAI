# Testing Implementation Plan

## Executive Summary

This document outlines a comprehensive plan for adding unit and integration tests to the YourApp application, prioritizing critical services that impact security, business logic, and user experience. The plan follows a phased approach, starting with the most critical services and building toward comprehensive coverage.

**Target Coverage Goals:**
- **Phase 1 (Critical):** 70%+ coverage on security and payment services
- **Phase 2 (Important):** 70%+ coverage on business logic services
- **Phase 3 (Comprehensive):** 70%+ overall code coverage

**For a plan to reach 100% test coverage,** see [Testing Plan: 100% Coverage](./testing-100-coverage-plan.md).

**Testing Tools (Already Configured):**
- Jest (unit & integration tests)
- React Testing Library (component tests)
- Playwright (E2E tests - separate plan)
- Supertest (API route tests)

**⚠️ Code Organization Requirement:**
- **All business logic must be in `/business` folders** (e.g., `features/generator/business/generator-service.ts`)
- This clearly separates domain-specific business logic from core infrastructure services
- Test organization mirrors source code: business logic tests in `__tests__/unit/business/`, infrastructure tests in `__tests__/unit/services/`

---

## Current State Assessment

### Existing Test Coverage

**Unit Tests:**
- ✅ Input validation (`__tests__/unit/validation/input-validation.test.ts`)
- ✅ API validation (`__tests__/unit/validation/api-validation.test.ts`)
- ✅ Auth validation (`__tests__/unit/validation/auth-validation.test.ts`)
- ✅ Checkout validation (`__tests__/unit/validation/checkout-validation.test.ts`)
- ✅ Contact validation (`__tests__/unit/validation/contact-validation.test.ts`)
- ✅ File validation (`__tests__/unit/validation/file-validation.test.ts`)
- ✅ Search validation (`__tests__/unit/validation/search-validation.test.ts`)
- ✅ Data validation (`__tests__/unit/utils/data-validation.test.ts`)
- ✅ Permissions (`__tests__/unit/permissions/generator-permissions.test.ts`, `core-feature-permissions.test.ts`)
- ✅ Config (`__tests__/unit/config/envUtil.test.ts`, `mock.test.ts`), stripe-map-loader (`__tests__/unit/utils/stripe-map-loader.test.ts`)
- ✅ Security/rate limit: csrf-protection, rate-limit-config, request-identity, middleware/helper
- ✅ Core services: safe-fetch, prisma, performance-monitor, resend
- ✅ Error handling & observability: api-error-wrapper, auth-error-handler, global-error-handler, system-logger, metrics
- ✅ Business logic (Phase 7): generator-service, generator-constants, generator-validation, payment-service
- ✅ Shared lib (Phase 8): query-keys, query-client
- ✅ Integration (Phase 9): api-security, api-health-and-generator
- ✅ SEO & security (Phase 10): metadata, page-metadata, structured-data, pii-sanitization
- ✅ Components & hooks with DOM (Phase 11): `__tests__/unit/components/query-provider.test.tsx`, `__tests__/unit/hooks/use-query-fetcher.test.tsx` (happy-dom in preload)
- ✅ Phase 12 – Middleware: `__tests__/integration/middleware.test.ts` (CORS preflight, security headers, config matcher)
- ✅ Utility functions (`__tests__/unit/utils/cn.test.ts`, `date.test.ts`, `pagination.test.ts`, `encryption.test.ts`, `response-helpers.test.ts`, `add-timezone-header.test.ts`, `subscription-type-guards.test.ts`)
- ✅ API route protection middleware (`__tests__/unit/middleware/api-route-protection.test.ts`)

**Integration Tests:**
- ✅ API security tests (`__tests__/integration/api-security.test.ts`)

**Test Infrastructure:**
- ✅ Bun test runner (`bun test`); config in `bunfig.toml`
- ✅ Test scripts: `test`, `test:unit`, `test:coverage`, `test:ci`
- ✅ Testing libraries: @testing-library/react, @testing-library/jest-dom; preload in `__tests__/setup/bun-preload.ts`

### Gaps Identified

**Critical Missing Tests:**
1. **Generator Service** - Core business logic with complex financial generations
2. **Payment Services** - Stripe integration, payment processing
3. **Subscription Services** - Subscription management, tier validation
4. **Rate Limiting** - Security-critical service
5. **CSRF Protection** - Security-critical service
6. **Database Services** - Prisma operations, Redis caching
7. **Firebase Services** - Authentication, Firestore operations
8. **Email Service** - Resend integration
9. **API Routes** - Most API endpoints lack integration tests

---

## Critical Services Prioritization

### 🔴 Tier 1: Critical Security & Payment Services (Start Here)

These services have the highest impact if broken and must be tested first:

#### 1. **CSRF Protection Service** (`shared/services/csrf/csrf-protection.ts`)
- **Why Critical:** Security vulnerability if broken
- **Risk:** CSRF attacks could allow unauthorized actions
- **Test Focus:**
  - Token generation and validation
  - Token expiry handling
  - Session ID validation
  - Signature verification
  - Edge cases (malformed tokens, expired tokens)

#### 2. **Rate Limiting Service** (`shared/services/rate-limit/comprehensive-rate-limiter.ts`)
- **Why Critical:** DDoS protection, API abuse prevention
- **Risk:** Service unavailability, resource exhaustion
- **Test Focus:**
  - Rate limit enforcement per endpoint type
  - IP blocking logic
  - Redis-based rate limiting
  - Alert triggering on exceed
  - Different rate limit configs (public, authenticated, admin)

#### 3. **Payment Service** (`features/payments/business/payment-service.ts`)
- **Why Critical:** Revenue impact, financial transactions
- **Risk:** Payment failures, incorrect charges, security breaches
- **Note:** This service should be in `/business` folder to separate business logic from infrastructure
- **Test Focus:**
  - Stripe integration (mocked)
  - Payment processing logic
  - Error handling for payment failures
  - Refund processing
  - Webhook validation

#### 4. **Stripe Payments Integration** (`shared/services/firebase/stripe-payments.ts`)
- **Why Critical:** Subscription billing, payment processing
- **Risk:** Billing errors, subscription failures
- **Test Focus:**
  - Stripe API calls (mocked)
  - Subscription creation
  - Payment method management
  - Webhook event handling

### 🟡 Tier 2: Core Business Logic Services

These services contain critical business logic that must work correctly:

#### 5. **Generator Service** (`features/generator/business/generator-service.ts`)
- **Why Critical:** Core product functionality
- **Risk:** Incorrect financial generations, user trust
- **Note:** This service should be moved to `/business` folder if not already there
- **Test Focus:**
  - Hook Generator generations (principal, interest, PMI, taxes)
  - Caption Generator generations
  - Script Generator generations (compound interest, growth projections)
  - Hashtag Generator generations
  - Amortization schedule generation
  - Edge cases (zero values, negative values, very large numbers)
  - Generation accuracy (compare against known results)

#### 6. **Subscription Service** (`features/subscriptions/hooks/use-subscription.ts` + related services)
- **Why Critical:** Subscription management, access control
- **Risk:** Incorrect tier access, billing issues
- **Test Focus:**
  - Subscription tier validation
  - Feature gating logic
  - Usage limit tracking
  - Subscription status checks
  - Tier upgrade/downgrade logic

#### 7. **Generator Permissions** (`shared/utils/permissions/generator-permissions.ts`)
- **Why Critical:** Access control for paid features
- **Risk:** Unauthorized access, revenue loss
- **Test Focus:**
  - Tier-based access rules
  - Free vs paid generator access
  - Permission checking logic

### 🟢 Tier 3: Infrastructure & Integration Services

These services support the application but are less critical:

#### 8. **Database Services** (`shared/services/db/`)
- **Prisma Client** (`prisma.ts`)
- **Redis Client** (`redis.ts`)
- **Performance Monitor** (`performance-monitor.ts`)
- **Test Focus:**
  - Database connection handling
  - Query execution
  - Transaction handling
  - Redis caching operations
  - Connection pooling
  - Error handling

#### 9. **Firebase Services** (`shared/services/firebase/`)
- **Admin SDK** (`admin.ts`)
- **Config** (`config.ts`)
- **Sync Service** (`sync.ts`)
- **Test Focus:**
  - Firebase Admin initialization
  - Firestore operations (mocked)
  - Authentication token verification
  - Custom claims management
  - Error handling

#### 10. **Email Service** (`shared/services/email/resend.ts`)
- **Why Important:** User communication, transactional emails
- **Test Focus:**
  - Email sending (mocked)
  - Template rendering
  - Error handling
  - Retry logic

#### 11. **Session Management** (`shared/services/session/session-manager.ts`)
- **Test Focus:**
  - Session creation and validation
  - Session expiry
  - Session ID generation

#### 12. **Storage Service** (`shared/services/storage/`)
- **Test Focus:**
  - File upload (mocked R2/S3)
  - File deletion
  - URL generation
  - Error handling

---

## API Route Integration Tests

### Critical API Routes (Priority Order)

#### 1. **Payment & Subscription APIs**
- `POST /api/subscriptions/checkout` - Subscription creation
- `GET /api/subscriptions/current` - Current subscription status
- `GET /api/subscriptions/portal-link` - Customer portal access

#### 2. **Generator API**
- `POST /api/generator/calculate` - Core generation endpoint
- `GET /api/generator/usage` - Usage tracking
- `GET /api/generator/history` - Generation history

#### 3. **Order APIs**
- `POST /api/customer/orders/create` - Order creation
- `GET /api/customer/orders` - Order listing
- `GET /api/customer/orders/[orderId]` - Order details

#### 4. **Admin APIs**
- `GET /api/admin/analytics` - Business metrics
- `GET /api/admin/subscriptions/analytics` - Subscription analytics
- `GET /api/admin/orders` - Order management

#### 5. **Security APIs**
- `GET /api/csrf` - CSRF token generation
- `POST /api/csrf` - CSRF token validation

#### 6. **Health & Monitoring APIs**
- `GET /api/health` - Health check
- `GET /api/ready` - Readiness check

---

## Phased Implementation Plan

### Phase 1: Critical Security & Payment (Weeks 1-2)

**Goal:** Secure the application and payment processing

#### Week 1: Security Services
1. **CSRF Protection Service Tests**
   - Unit tests for token generation
   - Unit tests for token validation
   - Unit tests for expiry handling
   - Integration test with API route

2. **Rate Limiting Service Tests**
   - Unit tests for rate limit checking
   - Unit tests for IP blocking
   - Integration tests with Redis (mocked)
   - Integration tests with API routes

#### Week 2: Payment Services
3. **Payment Service Tests** (`features/payments/business/payment-service.ts`)
   - **Ensure service is in `/business` folder before testing**
   - Unit tests for payment processing logic
   - Mocked Stripe API tests
   - Error handling tests
   - Refund processing tests

4. **Stripe Integration Tests**
   - Subscription creation tests
   - Webhook validation tests
   - Payment method tests

**Deliverables:**
- ✅ CSRF protection fully tested
- ✅ Rate limiting fully tested
- ✅ Payment services fully tested
- **Coverage Target:** 80%+ on security and payment services

---

### Phase 2: Core Business Logic (Weeks 3-4)

**Goal:** Ensure core product functionality works correctly

#### Week 3: Generator Service
5. **Generator Service Tests** (`features/generator/business/generator-service.ts`)
   - **Ensure service is in `/business` folder before testing**
   - Hook Generator generation tests (multiple scenarios)
   - Caption Generator generation tests
   - Script Generator generation tests
   - Hashtag Generator generation tests
   - Amortization schedule tests
   - Edge case tests (zero, negative, very large numbers)
   - Accuracy tests (compare against known results)

6. **Generator Permissions Tests**
   - Tier-based access tests
   - Free generator access tests
   - Permission validation tests

#### Week 4: Subscription Services
7. **Subscription Service Tests** (`features/subscriptions/business/subscription-service.ts`)
   - **Ensure service is in `/business` folder before testing**
   - Subscription tier validation
   - Feature gating logic
   - Usage limit tracking
   - Subscription status checks

**Deliverables:**
- ✅ Generator service fully tested
- ✅ Subscription logic fully tested
- **Coverage Target:** 75%+ on business logic services

---

### Phase 3: Infrastructure Services (Weeks 5-6)

**Goal:** Test supporting infrastructure

#### Week 5: Database & Firebase
8. **Database Service Tests**
   - Prisma operations (with test database)
   - Redis caching tests
   - Connection handling tests
   - Transaction tests

9. **Firebase Service Tests**
   - Admin SDK tests (mocked)
   - Firestore operations (mocked)
   - Authentication tests
   - Custom claims tests

#### Week 6: Other Services
10. **Email Service Tests**
    - Email sending (mocked Resend)
    - Template rendering
    - Error handling

11. **Session & Storage Tests**
    - Session management tests
    - Storage service tests (mocked R2)

**Deliverables:**
- ✅ Infrastructure services tested
- **Coverage Target:** 70%+ on infrastructure services

---

### Phase 4: API Route Integration Tests (Weeks 7-8)

**Goal:** End-to-end API testing

#### Week 7: Critical API Routes
12. **Payment & Subscription API Tests**
    - Subscription checkout flow
    - Current subscription endpoint
    - Portal link generation

13. **Generator API Tests**
    - Generation endpoint
    - Usage tracking
    - History retrieval

#### Week 8: Other API Routes
14. **Order API Tests**
    - Order creation
    - Order listing
    - Order details

15. **Admin API Tests**
    - Analytics endpoints
    - Management endpoints

16. **Security & Health API Tests**
    - CSRF endpoints
    - Health checks

**Deliverables:**
- ✅ All critical API routes tested
- **Coverage Target:** 70%+ on API routes

---

## Test Organization Structure

**Important:** Test organization mirrors source code organization. Business logic tests are in `/business` folders, infrastructure tests are in `/services` folders.

```
project/__tests__/
├── unit/
│   ├── business/                    # ⭐ BUSINESS LOGIC TESTS
│   │   ├── generator/
│   │   │   └── generator-service.test.ts
│   │   ├── payment/
│   │   │   └── payment-service.test.ts
│   │   ├── subscription/
│   │   │   └── subscription-service.test.ts
│   │   └── order/
│   │       └── order-service.test.ts
│   │
│   ├── services/                    # Infrastructure service tests
│   │   ├── csrf/
│   │   │   └── csrf-protection.test.ts
│   │   ├── rate-limit/
│   │   │   └── comprehensive-rate-limiter.test.ts
│   │   ├── db/
│   │   │   ├── prisma.test.ts
│   │   │   └── redis.test.ts
│   │   ├── firebase/
│   │   │   ├── admin.test.ts
│   │   │   └── stripe-payments.test.ts
│   │   ├── email/
│   │   │   └── resend.test.ts
│   │   ├── session/
│   │   │   └── session-manager.test.ts
│   │   └── storage/
│   │       └── storage.test.ts
│   │
│   ├── utils/                       # Utility function tests
│   │   ├── permissions/
│   │   │   └── generator-permissions.test.ts
│   │   └── validation/
│   │       └── input-validation.test.ts (existing)
│   │
│   └── middleware/                   # Middleware tests
│       └── api-route-protection.test.ts (existing)
│
├── integration/
│   ├── business/                     # ⭐ BUSINESS LOGIC INTEGRATION TESTS
│   │   ├── generator-integration.test.ts
│   │   ├── payment-integration.test.ts
│   │   ├── subscription-integration.test.ts
│   │   └── order-integration.test.ts
│   │
│   ├── api/
│   │   ├── subscriptions/
│   │   │   ├── checkout.test.ts
│   │   │   ├── current.test.ts
│   │   │   └── portal-link.test.ts
│   │   ├── generator/
│   │   │   ├── calculate.test.ts
│   │   │   ├── usage.test.ts
│   │   │   └── history.test.ts
│   │   ├── orders/
│   │   │   ├── create.test.ts
│   │   │   └── list.test.ts
│   │   ├── admin/
│   │   │   ├── analytics.test.ts
│   │   │   └── subscriptions.test.ts
│   │   ├── csrf/
│   │   │   └── csrf.test.ts
│   │   └── health/
│   │       └── health.test.ts
│   │
│   ├── services/                     # Infrastructure integration tests
│   │   ├── stripe-webhook.test.ts
│   │   └── database-operations.test.ts
│   │
│   └── api-security.test.ts (existing)
│
└── e2e/ (separate plan)
    └── ...
```

---

## Code Organization for Business Logic

### ⚠️ Critical Requirement: Business Logic in `/business` Folders

**All business logic must be organized in `/business` folders to clearly differentiate from core utilities and infrastructure services.**

**Organization Pattern:**
```
feature-name/
├── components/          # UI components
├── hooks/               # React hooks
├── business/            # ⭐ BUSINESS LOGIC (domain-specific)
│   ├── generator-service.ts
│   ├── payment-service.ts
│   ├── subscription-service.ts
│   └── order-service.ts
├── types/               # TypeScript types
└── utils/               # Feature-specific utilities (not business logic)

shared/
├── services/            # Core infrastructure services (not business logic)
│   ├── db/             # Database connections
│   ├── firebase/        # Firebase integration
│   ├── email/           # Email service
│   └── storage/         # File storage
├── utils/               # Core utilities (not business logic)
│   ├── validation/     # Input validation
│   └── permissions/     # Permission checks
└── business/           # ⭐ SHARED BUSINESS LOGIC (if needed)
    └── shared-business-service.ts
```

**Key Distinctions:**
- **`/business` folders** = Domain-specific business logic (generations, payment processing, subscription rules)
- **`/services` folders** = Infrastructure services (database, email, storage, external APIs)
- **`/utils` folders** = Pure utility functions (validation, formatting, helpers)

**Why This Matters:**
- Clear separation makes it easier to identify what needs business logic tests vs infrastructure tests
- Business logic tests focus on domain rules and generations
- Infrastructure tests focus on integration and error handling
- Makes refactoring and maintenance easier

**Example:**
```typescript
// ✅ CORRECT: Business logic in /business folder
features/generator/business/generator-service.ts
features/payments/business/payment-service.ts
features/subscriptions/business/subscription-service.ts

// ❌ WRONG: Business logic mixed with services
features/generator/services/generator-service.ts
shared/services/payment-service.ts
```

**When Writing Tests:**
- Business logic tests go in `__tests__/unit/business/` or `__tests__/integration/business/`
- Infrastructure service tests go in `__tests__/unit/services/` or `__tests__/integration/services/`
- This mirrors the source code organization

---

## Testing Best Practices

### 1. Mocking Strategy

**External Services to Mock:**
- **Stripe API** - Use `nock` or `jest.mock` to mock HTTP requests
- **Firebase Admin** - Mock Firebase Admin SDK methods
- **Firestore** - Mock Firestore operations
- **Redis** - Use in-memory Redis or mock ioredis
- **Resend API** - Mock email sending
- **R2/S3** - Mock AWS SDK calls
- **Database** - Use test database or Prisma mock

**Example Mock Pattern:**
```typescript
// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
    },
  }));
});
```

### 2. Test Database Setup

**Option 1: Test Database (Recommended for Integration Tests)**
- Use separate PostgreSQL database for tests
- Run migrations before test suite
- Clean database between tests
- Use transactions that rollback

**Option 2: Prisma Mock (For Unit Tests)**
- Mock Prisma client methods
- Faster execution
- No database required

### 3. Test Data Management

- Use factories for creating test data
- Create reusable test fixtures
- Use `beforeEach` to reset state
- Clean up after tests (`afterEach`, `afterAll`)

### 4. Coverage Goals

- **Unit Tests:** 70%+ coverage on business logic
- **Integration Tests:** 70%+ coverage on API routes
- **Critical Services:** 80%+ coverage (security, payment)

### 5. Test Naming Conventions

```typescript
describe('GeneratorService', () => {
  describe('calculateMortgage', () => {
    it('should calculate monthly payment correctly', () => {});
    it('should handle zero down payment', () => {});
    it('should throw error for negative caption generator amount', () => {});
  });
});
```

---

## Test Infrastructure Setup

### Required Test Utilities

Create shared test utilities in `__tests__/utils/`:

1. **Test Database Helper**
   - `setup-test-db.ts` - Initialize test database
   - `cleanup-test-db.ts` - Clean up after tests
   - `test-db-fixtures.ts` - Reusable test data

2. **Mock Helpers**
   - `mock-stripe.ts` - Stripe mocking utilities
   - `mock-firebase.ts` - Firebase mocking utilities
   - `mock-redis.ts` - Redis mocking utilities

3. **Test Helpers**
   - `test-helpers.ts` - Common test utilities
   - `api-test-helpers.ts` - API testing utilities

### Jest Configuration Updates

Update `jest.config.js` to include:
- Test environment setup
- Module path mapping
- Coverage thresholds
- Test file patterns

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ CSRF protection: 80%+ coverage
- ✅ Rate limiting: 80%+ coverage
- ✅ Payment services: 80%+ coverage
- ✅ All security tests passing

### Phase 2 Success Criteria
- ✅ Generator service: 75%+ coverage
- ✅ Subscription services: 75%+ coverage
- ✅ All business logic tests passing
- ✅ Generation accuracy verified

### Phase 3 Success Criteria
- ✅ Infrastructure services: 70%+ coverage
- ✅ All infrastructure tests passing

### Phase 4 Success Criteria
- ✅ API routes: 70%+ coverage
- ✅ All integration tests passing
- ✅ Overall code coverage: 70%+

---

## Risk Mitigation

### Risks Identified

1. **Time Constraints**
   - **Mitigation:** Prioritize Tier 1 services first
   - **Mitigation:** Use mocking to speed up tests

2. **Test Database Setup**
   - **Mitigation:** Use Docker for test database
   - **Mitigation:** Document setup process clearly

3. **External Service Dependencies**
   - **Mitigation:** Mock all external services
   - **Mitigation:** Use test doubles for integration tests

4. **Maintaining Test Quality**
   - **Mitigation:** Code review for all test code
   - **Mitigation:** Follow testing best practices
   - **Mitigation:** Regular test maintenance

---

## Next Steps

1. **Review and Approve Plan** - Get team/stakeholder approval
2. **Set Up Test Infrastructure** - Create test utilities and helpers
3. **Start Phase 1** - Begin with CSRF protection tests
4. **Track Progress** - Update this document as tests are added
5. **Update AI_Orchestrator** - Document test patterns and examples

---

## Related Documentation

- [Testing Plan: 100% Coverage](./testing-100-coverage-plan.md) – Phased plan to reach 100% coverage
- [Testing Strategy](../architecture/core/testing-strategy.md)
- [Production Readiness Checklist](./production-readiness.md)
- [Generator System](../architecture/domain/generator-system.md)
- [Subscription Architecture](../architecture/domain/subscription-architecture.md)
- [Payment Flows](../architecture/domain/payment-flows.md)

---

*Last Updated: [Current Date]*
*Status: Planning Phase*

