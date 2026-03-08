# 07 — Cleanup: Removing Unused SaaS Template Code

## Goal

Strip out the generic SaaS template features that don't belong in the Reel Studio. Do this early — before building new features — to keep the codebase clean and avoid confusion about what's active vs. legacy.

---

## Do This Step First

Run this before step 02. A clean codebase is easier to build on than one full of disconnected placeholder code.

---

## Frontend: Features to Remove

Delete entire feature folders that have no use in the Reel Studio:

```bash
# Delete unused features
rm -rf frontend/src/features/calculator
rm -rf frontend/src/features/contact
rm -rf frontend/src/features/faq
```

**Keep:**
- `features/account` — repurpose for user settings (studio preferences, connected pages)
- `features/admin` — keep for admin dashboard
- `features/auth` — keep unchanged
- `features/payments` — keep (Stripe subscriptions still needed)
- `features/subscriptions` — keep (gates Pro features)
- `features/customers` — evaluate: if it's just a user list for admins, keep a simplified version; if it's a customer-facing "my account" area, fold into `features/account`
- `features/orders` — remove (no orders in this platform)

```bash
rm -rf frontend/src/features/orders
```

---

## Frontend: Routes to Remove

Remove route files for deleted features:

```
frontend/src/routes/(customer)/calculator/   → DELETE
frontend/src/routes/(customer)/contact/      → DELETE
frontend/src/routes/(customer)/faq/          → DELETE
frontend/src/routes/(customer)/orders/       → DELETE
```

Remove any nav links pointing to these routes from shared layout components.

After deleting routes, regenerate the route tree:
```bash
cd frontend && bun dev
# TanStack Router auto-regenerates routeTree.gen.ts
```

---

## Frontend: Translation Keys to Remove

In `frontend/src/translations/en.json`, remove keys under:
- `calculator`
- `contact`
- `faq`
- `orders`

Add a comment block at the top of `en.json` to track removed keys (so translators don't re-add them by accident):
```json
{
  "_removed": ["calculator", "contact", "faq", "orders"],
  ...
}
```

---

## Backend: Routes to Remove

Remove or stub out backend routes for deleted features:

```
backend/src/routes/calculator.ts  → DELETE (if exists)
backend/src/routes/contact.ts     → DELETE (if exists)
backend/src/routes/faq.ts         → DELETE (if exists)
backend/src/routes/orders.ts      → DELETE (if exists)
```

Remove their registrations from `backend/src/index.ts`.

---

## DB Tables to Review

Don't drop tables from production — just stop using them and leave them for now. When the schema is stable, add a cleanup migration.

Tables that are likely irrelevant:
- `orders` — if exists, leave in DB but stop generating code for it
- `faq_items` — if exists, leave

Tables to keep:
- `users` — keep; add `subscription_tier` column if not present
- `subscriptions` — keep; Stripe still used

---

## Landing Page

Replace the generic SaaS landing page with a studio-focused one.

**`frontend/src/routes/(public)/index.tsx`**

New content:
- Hero: "Engineer Viral Reels at Scale" — studio screenshot/demo
- Feature callouts: Discover → Analyze → Generate → Queue
- Pricing section (keep existing Stripe integration; just update copy)
- CTA: "Start for free" → `/sign-up`

The design language should match the studio: dark background (`#08080F`), indigo/purple accents.

---

## Navbar / Sidebar Updates

After cleanup, update any global navigation components that reference removed routes:

- Remove links to `/calculator`, `/faq`, `/contact`, `/orders`
- Add links to `/studio` (main studio) and `/studio/queue`
- Keep `/account`, `/settings`, admin links

---

## envUtil Cleanup

Remove any env vars that were specific to template features that no longer exist. If a var was used only by a deleted feature, remove it from `envUtil.ts` and `.env.example`.

---

## Checklist

### Frontend
- [ ] `features/calculator` deleted
- [ ] `features/contact` deleted
- [ ] `features/faq` deleted
- [ ] `features/orders` deleted
- [ ] Corresponding routes deleted
- [ ] `routeTree.gen.ts` regenerated (no missing routes)
- [ ] `en.json` keys cleaned up
- [ ] Nav components updated (no broken links)
- [ ] Landing page updated with studio content

### Backend
- [ ] Unused route files deleted
- [ ] `index.ts` route registrations cleaned up
- [ ] No dead imports (`bun lint` passes)

### Verification
- [ ] `bun lint` passes in both `frontend/` and `backend/`
- [ ] `bun dev` starts without errors in both directories
- [ ] No 404 links in the app navigation
- [ ] Existing auth + subscription flows still work
