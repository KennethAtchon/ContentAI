# ReelStudio Business Model - Domain Architecture

## Overview

ReelStudio is a subscription-based AI content generation platform with three tiers (Basic, Pro, Enterprise), monthly generation limits, one-time purchases, and automated subscription management.

**Business Model:**
- Three subscription tiers with hierarchical access
- Monthly AI generation limits (50/500/unlimited)
- Free basic generators + tier-gated premium tools (Scripts, Voiceovers)
- One-time purchases separate from subscriptions
- Automated billing via Stripe + Firebase

---

## Table of Contents

1. [Subscription Tiers](#subscription-tiers)
2. [Pricing & Features](#pricing--features)
3. [Usage Limits](#usage-limits)
4. [Payment Flows](#payment-flows)
5. [Order System](#order-system)

---

## Subscription Tiers

### Tier Hierarchy

```
Enterprise (unlimited generations, all features)
    ↑
  Pro (500 generations/month, premium templates)
    ↑
  Basic (50 generations/month, viral hooks)
    ↑
  Free (basic captions only)
```

**Access Rules:**
- **Enterprise** users get all features
- **Pro** users get Pro + Basic + Free features
- **Basic** users get Basic + Free features
- **Free** users only get free basic generators

### Configuration

**Location:** `shared/constants/subscription.constants.ts`

```typescript
export const SUBSCRIPTION_TIERS = {
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];
```

---

## Pricing & Features

### Feature Matrix

| Feature | Free | Basic ($9/mo) | Pro ($29/mo) | Enterprise ($99/mo) |
|---------|------|---------------|--------------|---------------------|
| **Generations/Month** | Unlimited* | 50 | 500 | Unlimited |
| **Basic Captions** | ✅ | ✅ | ✅ | ✅ |
| **Viral Hooks** | ❌ | ✅ | ✅ | ✅ |
| **Full Video Scripts** | ❌ | ❌ | ✅ | ✅ |
| **Competitor Analysis** | ❌ | ❌ | ❌ | ✅ |
| **Export Options** | Local | Local | Direct Post | Multi-Platform API |
| **AI Voiceovers** | ❌ | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ❌ | ✅ |
| **Support** | Community | Email | Priority | Dedicated |

*Free users: unlimited for free tools only (basic captions)

### Generator Access by Tier

**Location:** `shared/utils/permissions/generator-permissions.ts`

```typescript
// Single source of truth for generator access
export const FEATURE_TIER_REQUIREMENTS = {
  hook generator: null,        // FREE - no subscription required
  caption generator: 'basic',         // Requires Basic or higher
  script generator: 'pro',     // Requires Pro or higher
  hashtag generator: 'enterprise', // Requires Enterprise
} as const;

// Check if user has access
export function hasGeneratorAccess(
  userTier: SubscriptionTier | null,
  generatorType: FeatureType
): boolean {
  const required = FEATURE_TIER_REQUIREMENTS[generatorType];
  
  // Free generator
  if (required === null) return true;
  
  // No subscription
  if (!userTier) return false;
  
  // Check tier hierarchy
  const tierOrder = { basic: 1, pro: 2, enterprise: 3 };
  return tierOrder[userTier] >= tierOrder[required];
}
```

---

## Usage Limits

### Monthly Generation Limits

```typescript
// shared/constants/subscription.constants.ts
export const TIER_LIMITS = {
  basic: { maxGenerationsPerMonth: 50 },
  pro: { maxGenerationsPerMonth: 500 },
  enterprise: { maxGenerationsPerMonth: -1 }, // Unlimited //
};
```

### Usage Tracking

**Database Model:** `GenerationHistory`

```prisma
model GenerationHistory {
  id              String   @id @default(uuid())
  userId          String
  generationType  String   // "hook", "caption", etc.
  inputData       Json     // Prompt inputs
  resultData      Json     // Generated text
  generationTime  Int      // Milliseconds
  createdAt       DateTime @default(now())
  
  @@index([userId, createdAt])
}
```

### Usage Flow

```
1. User submits generation prompt
2. Check: Does user have access to this AI tool type?
3. Check: Has user reached monthly limit?
4. Generate content via LLM
5. Save to GenerationHistory table
6. Return result + updated usage stats
```

### Usage Statistics

Users see real-time stats on their account dashboard:
- **Current Usage:** 23/50 generations this month
- **Percentage Used:** 46%
- **Limit Reached:** Warning when >= 80%, error at 100%
- **Resets:** Monthly on the 1st

---

## Payment Flows

### Subscription Payments

**Flow:** Firebase Stripe Extension (fully automated)

```
1. User selects tier on pricing page
2. Navigate to /checkout?tier=pro&billing=monthly
3. Client writes to Firestore: customers/{uid}/checkout_sessions
4. Firebase Extension creates Stripe Checkout session
5. User completes payment on Stripe
6. Extension creates subscription in Firestore
7. Extension sets custom claim: stripeRole='pro'
8. User redirected to /payment/success?type=subscription
9. Client forces token refresh to get new role
```

**Key Points:**
- Subscriptions stored in **Firestore** (not Prisma)
- Firebase Extension handles everything (webhooks, claims, etc.)
- No manual database writes needed
- Custom claim `stripeRole` used for access control

### Subscription Upgrade/Downgrade

**Important:** As of January 2026, ALL subscription plan changes must go through the Stripe Customer Portal. The pricing page and checkout flow are only for creating NEW subscriptions.

**Flow for Plan Changes (Portal-Only):**

```
1. User with existing subscription clicks "Manage Subscription" or "Upgrade"
2. Client uses usePortalLink() hook (SWR-cached portal link)
3. Hook calls /api/subscriptions/portal-link (POST) if not cached
4. API creates portal link via Firebase Extension
5. User redirected to Stripe Customer Portal
6. User changes subscription tier on Stripe portal
7. Stripe modifies existing subscription (same subscription ID)
8. Stripe webhooks → Firebase Extension updates Firestore
9. Extension updates stripeRole custom claim
10. User redirected back to /account
11. User refreshes token to see new tier
```

**Flow for New Subscriptions (Checkout):**

```
1. User WITHOUT subscription visits /pricing
2. User clicks "Get Started" on pricing card
3. User redirected to /checkout?tier={tier}&billing={cycle}
4. Checkout protection validates: No existing subscription? ✅
5. SubscriptionCheckout component creates new subscription
6. User completes Stripe Checkout
7. New subscription created
```

**Key Architecture:**
- **Pricing page is for NEW subscriptions only** - Users without subscriptions use checkout
- **All plan changes go through portal** - Users with subscriptions must use portal
- **Checkout is protected** - Validates no existing subscription before allowing checkout
- **Portal link is cached** - SWR automatically caches portal links for 5 minutes
- **No upgrade/downgrade logic in pricing components** - All routing is subscription-aware

---

## Order System

### One-Time Purchases

**Flow:** Direct Stripe integration (manual order creation)

```
1. User adds product to cart, clicks "Checkout"
2. Navigate to /checkout?type=order
3. Client calls /api/subscriptions/checkout (POST)
4. Server creates Stripe Checkout session (mode='payment')
5. User completes payment on Stripe
6. User redirected to /payment/success?type=order&session_id=xxx
7. OrderCreator component fetches session from Stripe
8. OrderCreator calls /api/customer/orders/create
9. Order saved to Prisma/PostgreSQL
10. Email confirmation sent
```

**Key Points:**
- Orders stored in **Prisma** (not Firestore)
- Manual creation after payment (OrderCreator component)
- Separate from subscriptions (different data stores)
- Email confirmation sent on order creation

### Order Model

```prisma
model Order {
  id              String   @id @default(uuid())
  userId          String
  totalAmount     Decimal  @db.Decimal(10, 2)
  status          String   @default("pending")
  stripeSessionId String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  isDeleted       Boolean  @default(false)
  
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([status])
}
```

### Order Status Flow

```
pending → processing → completed → delivered
                    ↓
                 failed → refunded
```

---

## Key Business Rules

### Subscription Rules

1. **Hierarchy:** Higher tiers include all lower tier features
2. **Limits:** Only paid tiers have generation limits (free generators are unlimited)
3. **Custom Claims:** `stripeRole` in Firebase is source of truth for tier
4. **Downgrade:** User keeps access until current billing period ends
5. **Cancellation:** Subscription continues until period end, then reverts to free

### Usage Rules

1. **Free Generators:** No usage tracking or limits (hook generator generator)
2. **Paid Generators:** Count toward monthly limit
3. **Monthly Reset:** Usage resets on 1st of each month
4. **Overage:** Hard limit - users can't calculate once limit reached
5. **Upgrade:** Instantly get new tier's higher limit

### Payment Rules

1. **Subscriptions:** Recurring monthly/yearly billing
2. **Orders:** One-time payment, no recurrence
3. **Refunds:** Admin-initiated through Stripe dashboard
4. **Failed Payments:** Stripe retries automatically, then cancels subscription

---

## Related Documentation

- [Subscription Portal-Only Refactor Plan](../plantofix/subscription-portal-only-refactor.md) - Complete refactor documentation
- [Subscription Upgrade/Downgrade Flow](../troubleshooting/subscription-upgrade-downgrade-flow.md) - Detailed flow explanation
- [Subscription System](./subscription-system.md) - Technical architecture details
- [Generator System](./generator-system.md) - Generator types and implementation
- [Account Management](./account-management.md) - User account features
- [Admin Dashboard](./admin-dashboard.md) - Admin management features

---

*Last Updated: January 2026 - Updated to reflect portal-only architecture for plan changes*
