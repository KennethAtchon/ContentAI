# Frontend Admin Routes Migration

Files in `frontend/src/routes/admin/` and `frontend/src/features/admin/`.

---

## Admin Route Files

### `src/routes/admin/index.tsx`
- Redirects to `/admin/dashboard`
- No brand text — safe as-is

### `src/routes/admin/_layout.tsx`
- Main admin layout with sidebar navigation
- Contains the nav items for all admin sections
- **What to check**: Sidebar item labels — if any say "Calculators" or similar, update to ReelStudio equivalents

### `src/routes/admin/_layout/dashboard.tsx`
- Renders `DashboardView` component
- No direct brand text in route file itself

### `src/routes/admin/_layout/customers.tsx`
- Renders `CustomersView` component

### `src/routes/admin/_layout/orders.tsx`
- Renders `OrdersView` component (or similar)

### `src/routes/admin/_layout/subscriptions.tsx`
- Renders subscription analytics

### `src/routes/admin/_layout/settings.tsx`
- Admin settings

### `src/routes/admin/_layout/developer.tsx`
- Developer tools panel

### `src/routes/admin/_layout/contactmessages.tsx`
- Contact message inbox

---

## Admin Feature Components

### `src/features/admin/components/dashboard/dashboard-view.tsx`

**Current state**: KPI cards and metrics for the admin overview. The specific metrics shown are likely:
- Total users / new users
- Revenue / MRR
- Active subscriptions
- Calculator usage count or similar product-specific metric

**What must change**:
- The product-specific KPI card (if it shows "Total Calculations") → change to "Total Reels Analyzed" or "Content Generated"
- Pull this count from the `reels` or `generatedContent` tables via a new admin API endpoint if needed
- Everything else (revenue, users, subscriptions) stays identical

**Action**: Read `dashboard-view.tsx` and find the product-specific metric card. Update its label and data source.

---

### `src/features/admin/components/dashboard/dashboard-layout.tsx`

**Current state**: Layout wrapper for the admin dashboard section.

**What must change**: Likely nothing — pure layout structure.

---

### `src/features/admin/components/dashboard/help-modal.tsx`

**Current state**: A help/onboarding modal for admins.

**What must change**:
- Check for calculator references in the help text
- If it explains "how the calculator API works" → update to explain ReelStudio admin capabilities
- If it's generic ("manage your users, subscriptions, etc.") → safe as-is

---

### `src/features/admin/components/customers/customers-list.tsx`
### `src/features/admin/components/customers/customers-view.tsx`
### `src/features/admin/components/customers/edit-customer-modal.tsx`

**Current state**: Customer management UI. Shows user list, allows searching, viewing details, editing.

**What must change**:
- No product-specific content expected here — users are users regardless of product
- **Check**: Does the customer detail view show "calculator usage" per user? If so, change to "reels analyzed" / "content generated"
- Everything else (name, email, tier, subscription status) stays the same

---

### `src/features/admin/components/orders/orders-list.tsx`
### `src/features/admin/components/orders/orders-view.tsx`
### `src/features/admin/components/orders/order-form.tsx`
### `src/features/admin/components/orders/recent-orders-list.tsx`
### `src/features/admin/components/orders/order-products-button.tsx`
### `src/features/admin/components/orders/order-products-modal.tsx`

**Current state**: Order management — subscription purchases, one-time purchases.

**What must change**:
- Order line items may reference "CalcPro Pro Plan" or "CalcPro Enterprise" — these come from Stripe metadata
- The order type labels in the UI should match the new product name: "ReelStudio Pro Plan" etc.
- **Check**: Are order type strings hardcoded or from translations/constants? Update wherever they live.
- No structural changes needed

---

### `src/features/admin/components/subscriptions/subscriptions-list.tsx`
### `src/features/admin/components/subscriptions/subscriptions-view.tsx`
### `src/features/admin/components/subscriptions/subscription-analytics.tsx`

**Current state**: Subscription analytics — tier breakdown (basic/pro/enterprise counts), MRR, churn rate.

**What must change**:
- No product-specific content expected — subscription analytics is product-agnostic
- If tier feature descriptions are shown inline → update from calculator features to ReelStudio features
- Tier names (basic/pro/enterprise) stay the same

---

## Summary: Admin Changes Required

| File | Change Level | Notes |
|------|-------------|-------|
| `routes/admin/index.tsx` | None | Just a redirect |
| `routes/admin/_layout.tsx` | Low | Check nav item labels |
| `routes/admin/_layout/*.tsx` | None | Pure route shells |
| `dashboard-view.tsx` | Low | 1 KPI card label change |
| `dashboard-layout.tsx` | None | Pure layout |
| `help-modal.tsx` | Low | Check for calculator references |
| `customers-*.tsx` | Low | Check user detail metrics |
| `orders-*.tsx` | Low | Check order type labels |
| `subscriptions-*.tsx` | None | Product-agnostic |

The admin section is **largely safe** — it's SaaS infrastructure that works the same regardless of product. The main risk is product-specific KPI labels and any hardcoded product references in help text.
