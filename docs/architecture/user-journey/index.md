# User Journey Index

ReelStudio is an AI-powered social media content intelligence platform. Users discover viral Instagram reels, get AI analysis of why they perform, generate original content inspired by that analysis, manage a production pipeline, and schedule to Instagram.

> **TODO (UX):** The UI/UX is jarring between pages — each page has its own unique layout that works for it, but navigation between them causes abrupt transitions. Need a unified layout shell or shared transition system.

---

## User Types

| Role | Description | Default Landing |
|---|---|---|
| **Guest** | Unauthenticated visitor | `/`, `/pricing`, `/about`, `/contact` |
| **Customer** | Authenticated user with a subscription | `/studio/discover` |
| **Admin** | Internal staff with elevated role | `/admin/dashboard` |

---

## Journey Files

| File | Journeys Covered |
|---|---|
| [01-authentication.md](./01-authentication.md) | Sign Up, Sign In, Sign Out, Auth Guards |
| [02-subscription-billing.md](./02-subscription-billing.md) | Pricing, Subscription Checkout, Order Checkout, Payment Success/Cancel, Upgrade, Stripe Portal |
| [03-discover.md](./03-discover.md) | Reel Discovery Feed, AI Analysis, Trending Audio |
| [04-generate.md](./04-generate.md) | Projects, Chat Sessions, AI Content Generation, Content Workspace, Iteration |
| [05-audio.md](./05-audio.md) | Voiceover Generation, Music Library, Volume Balancing |
| [06-queue.md](./06-queue.md) | Queue Management, Status Transitions, Scheduling, Duplicating |
| [07-editor.md](./07-editor.md) | Timeline Editor, Project Management |
| [08-account.md](./08-account.md) | Account Overview, Subscription Management, Usage, Orders, Profile, Preferences |
| [09-admin.md](./09-admin.md) | Admin Verification, Dashboard, Customers, Orders, Subscriptions, Niches, Music, System Config |

---

## Full Route Map

```
/                          — Home (public marketing)
/sign-in                   — Authentication
/sign-up                   — Registration
/pricing                   — Pricing plans
/about, /features, /faq, /contact, /support
/terms, /privacy, /cookies, /accessibility

/checkout                  — Checkout (auth required)
/payment/success           — Post-payment landing
/payment/cancel            — Aborted payment
/account                   — Account hub

/studio/discover           — Reel discovery feed
/studio/generate           — AI chat + generation workspace
/studio/queue              — Content production queue
/studio/editor             — Timeline editor (desktop only, ≥1280px)

/admin/dashboard           — Admin metrics
/admin/customers           — Customer management
/admin/orders              — Order management
/admin/subscriptions       — Subscription analytics
/admin/niches              — Niche CRUD
/admin/niches/$nicheId     — Niche detail + scrape management
/admin/music               — Music library
/admin/settings            — Admin profile settings
/admin/developer           — Developer tools
/admin/contactmessages     — Inbound contact messages
/admin/system-config       — System-level configuration
/admin/verify              — Admin role elevation
```

---

## Smart Redirect Logic

The app uses `useSmartRedirect` to determine where to send users:

| User Context | Destination |
|---|---|
| New user (just signed up) | `/pricing` |
| Returning authenticated user | `/studio/discover` |
| Unauthenticated | `/sign-in` |
| Had a `redirect_url` queued | That URL |

---

## Usage Gating

All AI features are gated by subscription tier. When a limit is hit:

1. Backend returns `429` from `usageGate` middleware
2. Frontend renders `LimitHitModal` showing current usage vs. limit
3. User is prompted to upgrade → `/checkout?tier=<next_tier>`
