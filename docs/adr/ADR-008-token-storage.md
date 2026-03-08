# ADR-008: Keep Firebase Token Storage in IndexedDB (Not httpOnly Cookies)

**Date:** Feb 2026  
**Status:** Accepted

## Context

Firebase Authentication stores tokens in IndexedDB by default. There was consideration to migrate to httpOnly cookies for improved XSS resilience (item 31 in the production readiness checklist).

## Decision

**Do not migrate to httpOnly cookies** at this time. Keep the Firebase SDK's default IndexedDB-based token storage.

Full evaluation is documented in `docs/runbooks/security-token-storage.md`.

## Rationale

1. `checkRevoked: true` is applied on all server-side `verifyIdToken` calls, giving immediate revocation
2. CSP headers (added Feb 2026) significantly reduce XSS attack surface
3. httpOnly cookie implementation requires custom session management that duplicates Firebase SDK functionality
4. Risk is assessed as LOW under the current threat model

## When to Revisit

- If SSR auth on every page is required
- If a compliance requirement mandates httpOnly-only storage
- If an XSS vulnerability bypasses the CSP

## Consequences

- ✅ No implementation complexity
- ✅ Full Firebase SDK compatibility (automatic token refresh)
- ✅ Risk mitigated by CSP + `checkRevoked: true`
- ⚠️ Tokens accessible to JavaScript (mitigated by CSP)
- ⚠️ Not ideal if strict httpOnly-only policy is required
