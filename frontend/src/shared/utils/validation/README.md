# Input Validation

This directory contains Zod validation schemas and utilities for validating user input across the application.

## Overview

Input validation is critical for security, especially to prevent XSS (Cross-Site Scripting) attacks. All user input should be validated before processing.

## Automatic Validation in API Routes

The easiest way to validate input is to use the built-in validation in API route protection:

```typescript
import { z } from "zod";
import { withUserProtection } from "@/shared/middleware/api-route-protection";

// Define your schema
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
});

async function handler(request: NextRequest) {
  // Body is already validated and type-safe
  const body = await request.json();
  // Use body.name and body.email safely
}

export const PUT = withUserProtection(handler, {
  bodySchema: updateProfileSchema, // Automatic validation!
  rateLimitType: "customer",
});
```

## Manual Validation

If you need more control, use the `validateInput` helper:

```typescript
import { validateInput } from "@/shared/utils/validation/api-validation";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const result = validateInput(schema, userInput, "context-name");

if (!result.success) {
  // Handle validation error
  return NextResponse.json(
    { error: result.error, details: result.details },
    { status: 422 }
  );
}

// Use validated data
const { email, name } = result.data;
```

## Available Validation Files

- **api-validation.ts** - General API request validation schemas
- **auth-validation.ts** - Authentication form validation
- **contact-validation.ts** - Contact form validation
- **checkout-validation.ts** - Checkout/payment validation
- **search-validation.ts** - Search query validation with SQL injection prevention
- **file-validation.ts** - File upload validation

## XSS Protection

All validation schemas should:

1. Use `.trim()` to remove whitespace
2. Set `.max()` limits to prevent large payloads
3. Use `.regex()` to allow only safe characters
4. Use `.transform()` to sanitize input when needed

Example:

```typescript
const safeInputSchema = z
  .string()
  .trim()
  .max(1000)
  .regex(/^[a-zA-Z0-9\s.,!?]+$/) // Only safe characters
  .transform((val) => val.replace(/<script>/gi, "")); // Remove script tags
```

## Best Practices

1. **Always validate** - Never trust user input
2. **Validate early** - Use automatic validation in route protection
3. **Be specific** - Use precise schemas, not generic `z.any()`
4. **Sanitize** - Use `.trim()`, `.transform()` to clean input
5. **Limit size** - Always set `.max()` to prevent DoS attacks
6. **Type safety** - Let TypeScript infer types from schemas
