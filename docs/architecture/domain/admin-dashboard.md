## Admin Dashboard

This document explains what the admin panel does and why certain things work the way they do.

---

## What Admins Can Do

The admin panel is a separate section of the app (`/admin/*`) that requires a Firebase admin-role token. Regular users can't access it. All data in the admin panel is unscoped — admins see all users, all orders, all subscriptions, not just their own.

The main sections:

**Dashboard** — Business metrics: MRR, active subscriptions, new users, churn rate. These are computed on request from the database and Firestore.

**Customers** — Search and view user profiles. Admins can update profile fields (name, email, phone). Subscription details are shown alongside the profile, but subscription changes happen on Stripe — there's no "set this user's tier" button in the app.

**Subscriptions** — A read-only view of all Firestore subscriptions with analytics (tier distribution, MRR breakdown). Read-only because Stripe is the source of truth. If an admin needs to change a subscription, they do it directly in the Stripe dashboard.

**Orders** — One-time purchase orders from PostgreSQL. Unlike subscriptions, these are fully managed here: admins can update status and soft-delete orders.

**Niches & Scraping** — Where admins manage the reel content library. Create niches, trigger Instagram scrape jobs, view job status, browse scraped reels, delete bad ones. See [Studio System](./studio-system.md) for how the scraping pipeline works.

**Music** — Upload and manage background music tracks. Tracks go into R2 and are available to users during video production.

**Developer** — Configure AI providers: which providers are active, their API keys, which models to use for each tier. Also a cache invalidation button. Changes take effect within ~60 seconds (Redis TTL). See [AI Provider System](./ai-provider-system.md) for how this works.

**Settings** — Admin's own profile management.

---

## Why Scraping Is Admin-Only

The scraping system costs money (Apify charges per actor run) and takes 1-2 minutes per niche scan. Users shouldn't be able to trigger unlimited scrapes. Admins control when content gets refreshed, at what frequency, and for which niches.

---

## Why Subscriptions Are Read-Only

Stripe is the authoritative record of subscription state. If admins could change subscription tiers directly in the app's database, those changes would be out of sync with Stripe — the billing wouldn't match the access. Admins use the Stripe Dashboard for anything that needs to change on the billing side.

---

## Security

All admin endpoints require a Firebase Admin JWT (the user's Firebase account must have the admin role set). All write operations also require a CSRF token. Rate limiting is stricter than customer limits (30 req/min). There's no admin-level override of these checks — even the "Invalidate Cache" button goes through the same middleware chain.
