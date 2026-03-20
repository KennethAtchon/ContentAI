# Admin Dashboard — Domain Architecture

## Overview

The Admin Dashboard (`/admin/*`) provides platform administrators with management capabilities across all key entities: users, subscriptions, orders, niches (content scraping), music library, and AI system configuration.

**Auth:** All admin routes require Firebase Admin JWT (`authMiddleware("admin")`) + CSRF protection. Rate-limited at 30 req/min.

---

## Admin Route Map

```
frontend/src/routes/admin/_layout/
├── dashboard.tsx      → MRR, churn, conversion metrics
├── customers.tsx      → Customer search + profile management
├── orders.tsx         → Order view, update, delete
├── subscriptions.tsx  → Subscription analytics
├── niches.tsx         → Niche + Instagram reel scraping
├── music.tsx          → Background music library management
├── developer.tsx      → AI provider config + system settings
└── settings.tsx       → Admin profile management
```

---

## Dashboard Metrics (`/admin/dashboard`)

**Component:** `features/admin/components/dashboard/dashboard-view.tsx`

Shows business metrics: MRR, active subscriptions, new users, churn rate, ARPU, conversion rate.

**Backend endpoint:**
```
GET /api/admin/metrics
Auth: admin
Response: {
  mrr: number,
  activeSubscriptions: number,
  newUsersThisMonth: number,
  churnRate: number,
  arpu: number,
  conversionRate: number
}
```

---

## Customer Management (`/admin/customers`)

Search and edit customer profiles. Admins can view subscription status, update profile fields, and access a customer's Stripe customer page.

**Backend endpoints:**
```
GET  /api/admin/users           → Paginated customer list (search, filter by tier)
GET  /api/admin/users/:id       → Single customer with subscription info
PUT  /api/admin/users/:id       → Update customer profile
```

---

## Order Management (`/admin/orders`)

View and manage one-time purchase orders (stored in PostgreSQL, separate from subscriptions).

**Backend endpoints:**
```
GET    /api/admin/orders          → List orders (search, filter by status)
GET    /api/admin/orders/:id      → Single order detail
PATCH  /api/admin/orders/:id      → Update order status
DELETE /api/admin/orders/:id      → Soft delete order
```

---

## Subscription Management (`/admin/subscriptions`)

View Firestore-backed subscriptions with analytics (tier distribution, MRR breakdown). Subscriptions are read-only here — changes go through Stripe.

---

## Niche & Scrape Management (`/admin/niches`)

Manages the content discovery pipeline. Niches are topic categories (e.g., "personalfinance") that drive Instagram reel scraping via Apify.

See the **Scrape System** section in [Studio System](./studio-system.md) for the full technical breakdown.

**Backend endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/niches` | List niches with reel counts |
| `POST` | `/api/admin/niches` | Create niche |
| `PUT` | `/api/admin/niches/:id` | Update niche |
| `DELETE` | `/api/admin/niches/:id` | Delete (blocked if reels exist) |
| `POST` | `/api/admin/niches/:id/scan` | Enqueue scrape job |
| `GET` | `/api/admin/niches/jobs/:jobId` | Poll job status |
| `GET` | `/api/admin/niches/:id/jobs` | Last 50 jobs for niche |
| `GET` | `/api/admin/niches/:id/reels` | Paginated reels |
| `POST` | `/api/admin/niches/:id/dedupe` | Remove duplicate reels |
| `DELETE` | `/api/admin/reels/:reelId` | Hard-delete a reel |

---

## Music Library Management (`/admin/music`)

Admins upload and manage background music tracks used during video assembly. See [Music Library System](./music-library-system.md) for the full system.

**Backend endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/music` | List all tracks (including inactive) |
| `POST` | `/api/admin/music` | Upload track (multipart/form-data) |
| `PUT` | `/api/admin/music/:id` | Update track metadata |
| `DELETE` | `/api/admin/music/:id` | Delete track + R2 file |

---

## AI Provider & System Config (`/admin/developer`)

Admins can configure which AI providers are active, set API keys, change model names, and adjust provider priority — all without redeploying. Changes take effect within ~60 seconds (Redis cache TTL).

See [AI Provider System](./ai-provider-system.md) for the full system.

**Backend endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/config` | All config rows (secrets redacted) |
| `GET` | `/api/admin/config/:category` | Config by category |
| `PUT` | `/api/admin/config/:category/:key` | Update a config value |
| `POST` | `/api/admin/config/cache/invalidate` | Force-clear Redis cache |

---

## Admin Settings (`/admin/settings`)

Admin profile management (name, email, phone, address, password change).

---

## Security Model

- All `/api/admin/*` endpoints require Firebase Admin JWT + CSRF token
- Rate-limited at 30 req/min (stricter than customer limits)
- All write operations require CSRF token
- Data access is not scoped to a user — admins see all records

---

## Related Documentation

- [Studio System](./studio-system.md) — Scrape system details
- [AI Provider System](./ai-provider-system.md) — DB-backed AI configuration
- [Music Library System](./music-library-system.md) — Music track management
- [Subscription System](./subscription-system.md) — Subscription architecture

---

*Last updated: March 2026*
