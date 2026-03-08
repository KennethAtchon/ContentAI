# Security: Token Storage — Firebase Auth & httpOnly Cookies

**Item 31 — Evaluated Feb 21, 2026**

---

## Current State

Firebase Authentication stores tokens in **IndexedDB** (via `firebase/auth` SDK).

- **ID Token:** Short-lived (~1 hour), refreshed automatically by the SDK
- **Refresh Token:** Long-lived, stored in IndexedDB
- **Storage location:** `indexeddb://firebaseLocalStorageDb` in the browser

---

## Risk Assessment

| Risk | Severity | Mitigated by |
|------|----------|--------------|
| XSS access to IndexedDB tokens | Medium | CSP headers restrict inline scripts; `checkRevoked: true` on all server-side token verification |
| Token replay after logout | Low | `checkRevoked: true` + Firebase revokes refresh tokens on sign-out |
| Token theft via browser extension | Low | Extension sandboxing; cannot access IndexedDB of other origins |

---

## Decision: Maintain Firebase SDK Defaults (IndexedDB)

**Verdict: No migration to httpOnly cookies at this time.**

### Rationale

1. **Complexity:** Migrating from Firebase SDK token management to a custom httpOnly cookie flow requires:
   - A custom server-side `/api/session` endpoint to exchange Firebase ID tokens for session cookies
   - `firebase-admin.createSessionCookie()` for each login
   - Cookie rotation and revocation middleware
   - Incompatibility with Firebase's built-in token refresh — must implement manual refresh

2. **Risk already mitigated:** `checkRevoked: true` is applied on all server-side token verification calls. Revoked tokens are rejected within seconds across all API routes.

3. **CSP headers** (set Feb 21, 2026) significantly reduce XSS attack surface.

4. **Firebase's own recommendation** for web apps is to use the SDK's built-in persistence (IndexedDB), reserving session cookies for cases where SSR auth is required on every request.

### When to reconsider

Migrate to httpOnly cookies if:
- SSR auth is needed on every page (currently only API routes check tokens)
- A compliance requirement (e.g. PCI DSS) mandates httpOnly-only token storage
- An XSS vulnerability is found that bypasses the current CSP

---

## If httpOnly Cookies Are Implemented in Future

### Implementation Plan

```typescript
// POST /api/session — exchange Firebase ID token for a session cookie
import { auth } from "@/shared/services/auth/firebase-admin";

const sessionCookie = await auth.createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 5 * 1000, // 5 days
});

// Set as httpOnly cookie
response.cookies.set("session", sessionCookie, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 24 * 5,
});
```

```typescript
// middleware.ts — verify session cookie on every request
const sessionCookie = request.cookies.get("session")?.value;
const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
```

### Trade-offs

| Aspect | Current (IndexedDB) | httpOnly Cookies |
|--------|--------------------|-|
| XSS resilience | Moderate | High |
| Implementation complexity | Low | High |
| Firebase SDK compatibility | Full | Partial (manual refresh required) |
| SSR auth support | No | Yes |
| Token revocation speed | Immediate (checkRevoked) | Immediate (verifySessionCookie) |

---

## See Also

- `docs/AI_Orchestrator/architecture/core/authentication.md`
- `docs/AI_Orchestrator/consider/owasp-top10-review.md`
