# Integration Tests with Vitest

## Overview

Integration tests verify that multiple parts of your application work together correctly. With Vitest, you can test:

- ✅ **API Routes** - Full request/response cycles
- ✅ **Database Operations** - Prisma queries, transactions
- ✅ **Service Integrations** - Firebase, Stripe, Redis
- ✅ **Authentication Flows** - Token validation, role checks
- ✅ **Business Logic** - Complex workflows across services

## Why Vitest for Integration Tests?

1. **Faster** - Uses Vite/esbuild, much faster than Jest
2. **Better TypeScript** - Native TS support, no ts-jest needed
3. **Better Async** - Handles async/await and promises better
4. **Modern API** - Same API as Jest, easier migration
5. **Great for API Testing** - Works perfectly with Next.js API routes

## Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/shared/services/db/prisma";

describe("API Integration", () => {
  beforeAll(async () => {
    // Setup: Connect to test database, seed data
  });

  afterAll(async () => {
    // Cleanup: Disconnect, clean test data
    await prisma.$disconnect();
  });

  it("should handle API requests", async () => {
    // Test your API route
    const request = new NextRequest("http://localhost:3000/api/health");
    // Import and test route handler
  });

  it("should interact with database", async () => {
    // Test database operations
    const user = await prisma.user.create({...});
    expect(user).toBeDefined();
  });
});
```

## Running Integration Tests

```bash
# Run all integration tests
bun run test __tests__/integration

# Run specific test file
bun run test __tests__/integration/api/users.test.ts

# Watch mode
bun run test:watch __tests__/integration

# With coverage
bun run test:coverage
```

## Best Practices

1. **Use Test Database** - Always use a separate test database
2. **Clean Up** - Clean up test data after each test
3. **Isolate Tests** - Each test should be independent
4. **Mock External Services** - Mock Firebase, Stripe in tests
5. **Test Real Flows** - Test actual user workflows

## Example: Testing API Route

```typescript
import { GET } from "@/app/api/customer/profile/route";
import { NextRequest } from "next/server";

describe("GET /api/customer/profile", () => {
  it("should return user profile data when authenticated", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/customer/profile",
      {
        headers: {
          Authorization: "Bearer valid-token",
        },
      },
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("profile");
    expect(data).toHaveProperty("isOAuthUser");
  });
});
```
