# Domain Architecture (Template Default)

## Overview

**Template default** business logic and feature implementations. This documentation describes the **example implementation** (financial studio tool product, YourApp-style). You can keep it or replace it with your own core feature—see [Template roadmap](../../template-roadmap.md) and [Where to start coding](../../where-to-start-coding.md).

**What's in Domain:**
- Subscription tiers (Basic/Pro/Enterprise) and tier configuration
- Core feature types and tier requirements (default: studio tool types)
- Usage limits and pricing rules
- Admin and customer-facing features

**What's NOT in Domain:**
- Generic infrastructure (see `/core`)
- Firebase/Stripe implementation details (see `/core`)
- Deployment guides (see `/consider`)

---

## Domain Documentation

### 💰 Business Model

**[Business Model](./business-model.md)** - *YourApp's subscription & payment model*
- Three subscription tiers (Free, Basic, Pro, Enterprise)
- Pricing and feature matrix
- Monthly usage limits (50/500/unlimited generations)
- Studio Tool access rules (hook generator=free, caption generator=basic, script generator=pro, hashtag generator=enterprise)
- Payment flows (subscriptions vs one-time orders)
- Order system (one-time purchases)

**[Subscription System](./subscription-system.md)** - *Complete subscription system architecture*
- Firebase Stripe Extension integration
- Subscription lifecycle (creation, updates, cancellation)
- Custom claims and access control
- API endpoints and client-side integration
- Usage tracking and limits
- Admin management and troubleshooting

### 🧮 Core Features

**[Studio Tool System](./studio tool-system.md)** - *Financial studio tool implementation*
- Studio Tool types (hook generator, caption generator, script generator, hashtag generator)
- Generation algorithms and formulas
- Input validation and result formatting
- Tier-based access control
- Usage tracking integration

**[Account Management](./account-management.md)** - *Customer account features*
- Profile editor (name, email, phone, address)
- Subscription management (upgrade, downgrade, cancel)
- Usage dashboard (current usage vs limits)
- Studio Tool interface access
- Order history

**[Admin Dashboard](./admin-dashboard.md)** - *Admin management features*
- Metrics dashboard (MRR, ARPU, churn, conversion)
- Customer management (search, edit, view subscriptions)
- Order management (view, update, soft delete)
- Subscription analytics
- User role management

---

## Quick Reference

### File Count: 5 files

**Domain documentation:** 5 files, focused on YourApp-specific features
- Business Model
- Subscription System
- Studio Tool System
- Account Management
- Admin Dashboard

### What Was Consolidated

| Old Files | New File |
|-----------|----------|
| subscription-architecture.md, feature-gating.md, usage-tracking.md, payment-flows.md, order-system.md | business-model.md |

### What Was Removed

Generic infrastructure (moved to core):
- `firebase-integration.md` → See [core/authentication.md](../core/authentication.md)
- `data-models.md` → See [core/database.md](../core/database.md)

---

## YourApp Business Logic

### Subscription Tiers

```
Free        → Hook Generator studio tool (unlimited)
Basic $9    → + Caption Generator studio tool (50 generations/month)
Pro $29     → + Script Generator studio tool (500 generations/month)  
Enterprise $99 → + Hashtag Generator studio tool (unlimited)
```

### Studio Tool Access Rules

```typescript
// Single source of truth
FEATURE_TIER_REQUIREMENTS = {
  hook generator: null,        // FREE
  caption generator: 'basic',         // Requires Basic+
  script generator: 'pro',     // Requires Pro+
  hashtag generator: 'enterprise', // Requires Enterprise
}
```

### Usage Limits

- **Free:** Unlimited for free studio tools (hook generator)
- **Basic:** 50 generations/month for paid studio tools
- **Pro:** 500 generations/month
- **Enterprise:** Unlimited

Limits reset on the 1st of each month. Hard limit enforced - users blocked at 100%.

### Payment Model

**Subscriptions:**
- Stored in Firestore (Firebase Stripe Extension)
- Recurring monthly/yearly billing
- Automatic role updates via custom claims
- Managed through Stripe Customer Portal

**Orders:**
- Stored in Prisma/PostgreSQL
- One-time payments (no recurrence)
- Manual creation after Stripe payment
- Email confirmation sent

---

## How to Use This Documentation

### For New Engineers

Start with:
1. [Business Model](./business-model.md) - Understand subscription tiers, pricing, usage limits
2. [Subscription System](./subscription-system.md) - Understand how subscriptions work technically
3. [Studio Tool System](./studio tool-system.md) - Understand studio tool types and access rules
4. [Account Management](./account-management.md) - Understand customer features
5. [Admin Dashboard](./admin-dashboard.md) - Understand admin capabilities

### For Specific Features

- **Adding studio tool type:** [Studio Tool System](./studio tool-system.md)
- **Changing subscription tiers:** [Business Model](./business-model.md)
- **Modifying usage limits:** [Business Model](./business-model.md)
- **Understanding subscription flow:** [Subscription System](./subscription-system.md)
- **Firebase Extension integration:** [Subscription System](./subscription-system.md)
- **Adding admin feature:** [Admin Dashboard](./admin-dashboard.md)
- **Customer feature:** [Account Management](./account-management.md)

### For Business Logic Questions

- **What studio tools does Pro tier get?** → [Business Model](./business-model.md)
- **How are usage limits enforced?** → [Business Model](./business-model.md)
- **How do subscriptions work?** → [Subscription System](./subscription-system.md)
- **How does Firebase Stripe Extension work?** → [Subscription System](./subscription-system.md)
- **How are custom claims managed?** → [Subscription System](./subscription-system.md)
- **What can admins do?** → [Admin Dashboard](./admin-dashboard.md)
- **How does hook generator generation work?** → [Studio Tool System](./studio tool-system.md)

---

## Related Documentation

- [Core Architecture](../core/) - Generic infrastructure patterns
- [Implementation Plans](../../consider/) - Guides and strategies
- [Project Overview](../../overview.md) - High-level project info

---

*Last Updated: January 2026*
*Consolidation: Reduced from 11 files to 4 YourApp-specific documents*