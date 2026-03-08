# ADR-003: Split Data Between PostgreSQL and Firestore

**Date:** Nov 2025  
**Status:** Accepted

## Context

The app needs to store:
1. Structured business data (users, orders, calculator usage)
2. Subscription state (managed by Firebase Stripe Extension, which writes to Firestore)

## Decision

Use a **split data strategy**:
- **PostgreSQL (via Prisma):** Users, orders, calculator usage history, contact messages
- **Firestore:** Subscriptions only (managed exclusively by Firebase Stripe Extension)

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Everything in PostgreSQL | Firebase Stripe Extension writes subscriptions to Firestore; would require custom sync |
| Everything in Firestore | Poor relational query support; no migrations; harder to do complex analytics |
| Sync Firestore subscriptions to PostgreSQL | Double source of truth; sync bugs are a maintenance nightmare |

## Consequences

- ✅ Firebase Stripe Extension works without modification
- ✅ Prisma provides type-safe queries, migrations, and relations for business data
- ✅ Clear separation of concerns — subscription lifecycle is Firebase's responsibility
- ⚠️ Two databases to maintain and back up
- ⚠️ Admin views that need both subscription + user data must query both stores
- ⚠️ Cannot do cross-store JOIN queries; must merge in application code
