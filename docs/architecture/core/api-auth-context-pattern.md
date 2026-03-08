# Auth Context Passthrough Pattern

## The Problem

Every protected API route currently calls `requireAuth` (or `requireAdmin`) **twice** per request:

1. **First call** — inside `withApiProtection` via `validateAuthentication`, which verifies the Firebase token and checks the user's role. This call's result is discarded.
2. **Second call** — manually at the top of every handler body, to get the decoded user object (`authResult.user`, `authResult.firebaseUser`).

```typescript
// ❌ BEFORE — double Firebase token verification per request
async function postHandler(request: NextRequest) {
  // Second verify — redundant, only here because the wrapper discards its result
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // ... now uses authResult.user.id, authResult.firebaseUser.stripeRole, etc.
}

export const POST = withUserProtection(postHandler, { ... });
//                  ^^^^^^^^^^^^^^^^^^^
//                  Already calls requireAuth internally — first verify
```

Firebase token verification is not free: it's a cryptographic JWT validation + optional DB lookup
(`getOrCreateDbUser`). Doubling it on every protected route is pure waste.

---

## The Scalable Fix

Change `withApiProtection` to pass an `AuthContext` as the second argument to the handler,
alongside the existing Next.js route `context` (dynamic params, etc.).

### Step 1 — Define `AuthContext`

```typescript
// shared/middleware/api-route-protection.ts

import type { AuthResult, AdminAuthResultWithDbUserId } from "@/features/auth/types/auth.types";

/** Auth result passed to handler when requireAuth is set */
export type AuthContext = AuthResult | AdminAuthResultWithDbUserId | null;

/** Updated handler signature — second arg is now { auth, params } */
export interface RouteHandler {
  (
    request: NextRequest,
    context: { auth: AuthContext; params?: any }
  ): Promise<NextResponse> | NextResponse;
}
```

### Step 2 — Return `AuthContext` from `validateAuthentication`

```typescript
// shared/middleware/helper.ts

/**
 * Validates authentication and returns the auth result so it can be
 * forwarded to the handler — avoids a second requireAuth call.
 */
export async function validateAuthentication(
  request: NextRequest,
  authLevel: "user" | "admin"
): Promise<{ error: NextResponse; auth: null } | { error: null; auth: AuthContext }> {
  try {
    if (authLevel === "admin") {
      const result = await requireAdmin(request);
      if (result instanceof NextResponse) return { error: result, auth: null };
      return { error: null, auth: result };
    } else {
      const result = await requireAuth(request);
      if (result instanceof NextResponse) return { error: result, auth: null };
      return { error: null, auth: result };
    }
  } catch {
    return {
      error: new NextResponse(JSON.stringify({ error: "Auth validation failed" }), { status: 500 }),
      auth: null,
    };
  }
}
```

### Step 3 — Thread it through `withApiProtection`

```typescript
// shared/middleware/api-route-protection.ts

export function withApiProtection(handler: RouteHandler, options: ProtectionOptions = {}) {
  return async (request: NextRequest, nextContext?: any): Promise<NextResponse> => {
    // ... CORS, rate limit, CSRF checks ...

    let authContext: AuthContext = null;

    if (options.requireAuth) {
      const { error, auth } = await validateAuthentication(request, options.requireAuth);
      if (error) return error;
      authContext = auth;
    }

    // ... input validation ...

    // Pass auth as part of context — handlers receive it as context.auth
    const response = await handler(request, { auth: authContext, params: nextContext?.params });

    // ... metrics, security headers ...
    return response;
  };
}
```

### Step 4 — Handlers receive auth, never call requireAuth again

```typescript
// ✅ AFTER — single Firebase token verification per request
async function postHandler(
  request: NextRequest,
  { auth }: { auth: AuthResult }  // typed, never null when withUserProtection is used
) {
  // auth is already verified and populated by the wrapper
  const { user, firebaseUser } = auth;
  const stripeRole = toSubscriptionTier(firebaseUser.stripeRole);

  // ... rest of handler, no requireAuth call ...
}

export const POST = withUserProtection(postHandler, { ... });
```

---

## Type Safety

Use overloaded or narrowed types for the convenience wrappers so TypeScript knows the
auth level without casting:

```typescript
/** Handler that always receives a non-null user AuthResult */
export interface UserRouteHandler {
  (request: NextRequest, context: { auth: AuthResult; params?: any }): Promise<NextResponse> | NextResponse;
}

/** Handler that always receives a non-null admin AuthResult */
export interface AdminRouteHandler {
  (request: NextRequest, context: { auth: AdminAuthResultWithDbUserId; params?: any }): Promise<NextResponse> | NextResponse;
}

export function withUserProtection(handler: UserRouteHandler, options: ProtectionOptions = {}) {
  return withApiProtection(handler as RouteHandler, { ...options, requireAuth: "user", rateLimitType: "customer" });
}

export function withAdminProtection(handler: AdminRouteHandler, options: ProtectionOptions = {}) {
  return withApiProtection(handler as RouteHandler, { ...options, requireAuth: "admin", rateLimitType: "admin" });
}
```

---

## Migration

The change is **additive and backward-compatible** at the JS level — Next.js route handlers
already receive a second `context` argument (for dynamic params like `[id]`). We're just
structuring that argument to also carry `auth`.

Existing routes that still call `requireAuth` manually will still work correctly — they'll just
be doing a redundant verify until migrated. Migrate one route at a time by:

1. Remove the manual `requireAuth` / `requireAdmin` call and `if (authResult instanceof NextResponse)` check.
2. Add `{ auth }` to the handler parameters.
3. Replace `authResult` references with `auth`.

```diff
- async function getHandler(request: NextRequest) {
-   const authResult = await requireAuth(request);
-   if (authResult instanceof NextResponse) return authResult;
+ async function getHandler(request: NextRequest, { auth }: { auth: AuthResult }) {
    // ...
-   const stripeRole = toSubscriptionTier(authResult.firebaseUser.stripeRole);
+   const stripeRole = toSubscriptionTier(auth.firebaseUser.stripeRole);
-   const userId = authResult.user.id;
+   const userId = auth.user.id;
```

---

## Impact

| Before | After |
|--------|-------|
| 2× Firebase `verifyIdToken` per protected request | 1× Firebase `verifyIdToken` per request |
| 2× `getOrCreateDbUser` Prisma query per request | 1× `getOrCreateDbUser` Prisma query per request |
| ~16 routes with manual `requireAuth` boilerplate | 0 — auth delivered by wrapper |
| Handler must know how to parse the auth header | Handler receives strongly-typed `auth` object |
