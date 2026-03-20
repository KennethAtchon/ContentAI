# Account Management — Domain Architecture

## Overview

The account page (`/(customer)/account`) is the customer-facing hub for managing profile, subscription, and usage. It runs as a single TanStack Router route that mounts `AccountInteractive` — a client component handling all tabs.

**Features:**
- Profile editor (name, email, phone, address)
- Subscription management (view plan, access Stripe Customer Portal)
- Usage dashboard (daily/monthly generation counts vs tier limits)
- Order history

---

## Route Structure

```
frontend/src/routes/(customer)/
├── account.tsx           → route shell (AuthGuard + AccountInteractive)
└── account/
    └── -account-interactive.tsx  → tab shell + state

frontend/src/features/account/components/
├── profile-editor.tsx           → Profile tab content
├── subscription-management.tsx  → Subscription tab content
├── usage-dashboard.tsx          → Usage tab content
└── order-detail-modal.tsx       → Order detail drawer
```

**Auth:** `<AuthGuard authType="user">` — redirects to `/sign-in` if unauthenticated.

---

## Profile Editor

**Component:** `features/account/components/profile-editor.tsx`

Allows the user to update their profile fields. Uses `useApp().updateProfile` which calls `PATCH /api/users/profile`.

**Fields:**
- Name, email, phone, address, notes

**Backend endpoint:**
```
PATCH /api/users/profile
Auth: user
Body: { name?, email?, phone?, address?, notes? }
Response: { user: UserProfile }
```

---

## Subscription Management

**Component:** `features/account/components/subscription-management.tsx`

Displays the current subscription tier (read from `stripeRole` custom claim on the Firebase token). The actual plan change UI is Stripe's hosted Customer Portal — the component shows a "Manage Billing" button that redirects to the portal.

**Data source:** Firebase custom claim `stripeRole` (fast, no API call needed).

**Backend endpoints:**
```
POST /api/subscriptions/portal
Auth: user, CSRF
Response: { url: string }  → redirect user to Stripe Customer Portal

GET /api/subscriptions/current
Auth: user
Response: { subscription: { tier, status, currentPeriodEnd } | null }
```

See [Subscription System](./subscription-system.md) for the full lifecycle.

---

## Usage Dashboard

**Component:** `features/account/components/usage-dashboard.tsx`

Shows the user's AI generation usage relative to their tier limits. Limits are enforced server-side; this component is for visibility only.

**Backend endpoint:**
```
GET /api/users/usage
Auth: user
Response: {
  tier: "free" | "basic" | "pro" | "enterprise",
  daily: { used: number, limit: number | null },
  monthly: { used: number, limit: number | null }
}
```

**Tier limits** (from [Business Model](./business-model.md)):

| Tier | Daily Generations | Daily Analyses |
|------|------------------|---------------|
| Free | 1 | 2 |
| Basic | 10 | 10 |
| Pro | 50 | Unlimited |
| Enterprise | Unlimited | Unlimited |

---

## Order History

Fetched alongside the profile data. Users can click an order to open `OrderDetailModal`.

**Backend endpoint:**
```
GET /api/users/orders
Auth: user
Response: { orders: Order[] }
```

---

## Related Documentation

- [Business Model](./business-model.md) — Tier limits and pricing details
- [Subscription System](./subscription-system.md) — How subscriptions are stored and updated

---

*Last updated: March 2026*
