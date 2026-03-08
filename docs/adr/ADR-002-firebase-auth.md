# ADR-002: Use Firebase for Authentication

**Date:** Nov 2025  
**Status:** Accepted

## Context

We need user authentication with email/password, Google OAuth, and session management. Speed of implementation matters; building auth from scratch is risky.

## Decision

Use **Firebase Authentication** for all user identity management, with `firebase-admin` on the server side for token verification.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Auth.js (NextAuth) | More complex setup with Prisma adapter; Firebase chosen for Firestore subscription integration |
| Clerk | Paid service with vendor lock-in; Firebase free tier sufficient |
| Custom JWT auth | Too much time to build securely; auth is not a differentiator |
| Supabase Auth | Would require replacing Firebase Stripe Extension |

## Consequences

- ✅ Built-in email/password, Google OAuth, social providers
- ✅ Tight integration with Firebase Stripe Extension for subscriptions
- ✅ `checkRevoked: true` provides instant session revocation
- ✅ No custom token management required
- ⚠️ Tokens stored in IndexedDB (not httpOnly cookies) — see ADR-008
- ⚠️ Firebase vendor lock-in; migration would require replacing auth everywhere
- ⚠️ Requires `firebase-admin` on all auth-gated API routes
