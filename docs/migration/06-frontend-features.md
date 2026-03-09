# Frontend Feature Components Migration

All files in `frontend/src/features/`.

---

## Features That Are Complete ✅

These features were built during the migration and require no further changes (only verification):

- `features/reels/` — all files (components, hooks, types)
- `features/generation/` — all files
- `features/studio/` — StudioTopBar.tsx

---

## Features to Remove

### `features/account/components/calculator-interface.tsx`
**Action**: Delete this file after removing the Calculator tab from account-interactive.tsx.
It is a dead stub — its only content is a message saying "go to ReelStudio".

---

## Features to Update

### `features/account/components/usage-dashboard.tsx`

**Current state**: Shows monthly usage statistics. Was previously tracking calculator types (mortgage, loan, etc.). A previous pass removed the calculator-specific imports but the display labels may still reference "calculations".

**What to read**: Open the file and audit every label/string.

**What to change**:
- Find any label like "Total Calculations", "Calculation Limit", "Calculator Type"
- Replace with:
  - "Reels Analyzed"
  - "Content Generated"
  - "Queue Items"
  - "Daily Analysis Limit"
- The usage chart groupings: if it groups by "calculator type" → change to group by feature type (analysis, generation, queue)
- Update relevant translation keys

---

### `features/account/components/profile-editor.tsx`

**Current state**: User profile editor — name, email, phone, address, timezone.

**What to change**: Probably nothing. Profile editing is product-agnostic.
**Action**: Read the file and verify no calculator-specific fields or text.

---

### `features/account/components/subscription-management.tsx`

**Current state**: Shows current subscription tier, billing cycle, renewal date. Has upgrade/cancel buttons.

**What to change**:
- The subscription tier feature lists (what's included in basic/pro/enterprise) may reference calculator features
- Find where tier benefits are described and update to ReelStudio features
- If tier benefits come from `subscription.constants.ts` → update that file

---

### `features/account/components/order-detail-modal.tsx`

**Current state**: Modal showing order details — product name, amount, date, status.

**What to change**:
- The product name displayed ("CalcPro Pro Plan" etc.) comes from Stripe order data or constants
- Check if product names are hardcoded or from constants
- If from constants: update `stripe.constants.ts` with ReelStudio plan names
- If from Stripe: update the Stripe product names in the Stripe dashboard (outside codebase)

---

## Features to Verify (Likely Fine)

### `features/auth/`
All auth components are product-agnostic. Verify no CalcPro text in:
- `auth-guard.tsx` — pure logic, no brand text
- `user-button.tsx` — avatar dropdown, no brand text
- `use-authenticated-fetch.ts` — pure hook, no brand text

### `features/payments/`
Payment flow is product-agnostic. Verify:
- `checkout/order-checkout.tsx` — check for calculator references in order summary
- `checkout/subscription-checkout.tsx` — check plan descriptions
- `success/order-confirmation.tsx` — already fixed (`/studio/discover` link)
- `success/subscription-success.tsx` — check CTA text after success
- `success/order-creator.tsx` — check for calculator product references
- `stripe-payment-fallback.tsx` — check for calculator references

### `features/subscriptions/`
- `feature-gate.tsx` — gates features by tier. Feature names should now be studio features (studio, generation, queue, publishing). Verify the feature type names shown to users are ReelStudio-relevant.
- `manage-subscription-button.tsx` — "Manage Subscription" label — fine as-is
- `upgrade-prompt.tsx` — shows upgrade message when user hits a feature gate. The feature name shown ("You need Pro to access Investment Calculator") needs to be updated to ReelStudio features. Check how the feature name is displayed.
- `use-subscription.ts` — pure hook, no brand text

---

## Admin Feature Components

### `features/admin/components/dashboard/dashboard-view.tsx`

**What to read and check**:
1. What KPI cards are shown? Look for a "Total Calculations" or "Calculator Usage" card
2. What data endpoints does it call? If `/api/analytics/calculator` exists and is removed → break the dashboard

**What to change**:
- Replace any "Total Calculations" metric with "Total Reels Analyzed" (query the `reels` table count)
- Replace any "Calculator Calls This Month" with "Content Generated This Month" (query `generatedContent` table)
- The endpoint for this data likely lives in `/api/analytics` → may need a new endpoint or update the existing one

---

### `features/admin/components/customers/customers-view.tsx`

**What to read and check**:
- Does the customer detail show per-user calculator usage?
- If so, update to show reel analysis count and content generation count per user

---

## Shared SaaS Components

### `shared/components/saas/PricingCard.tsx`

**Current state**: Renders a pricing tier card with feature list.

**What to change**:
- The feature list items come from the `features` array passed as props (from `subscription.constants.ts`)
- This component itself is generic — no changes needed HERE
- **Update the data source**: `subscription.constants.ts` feature lists

---

### `shared/components/saas/UpgradePrompt.tsx`

**Current state**: Shows a locked feature message with upgrade CTA.

**What to change**:
- The feature name displayed may say "Investment Calculator" or "Retirement Planner"
- The feature type is passed as a prop from `core-feature-permissions.ts` which now uses studio feature names
- Verify the rendered text makes sense for ReelStudio features ("Upgrade to access Publishing")

---

### `shared/components/saas/FeatureComparison.tsx`

**Current state**: A feature comparison table (possibly used on pricing page).

**What to change**:
- The rows in the comparison table are the features — these definitely reference calculator types
- Replace comparison rows with ReelStudio feature matrix:
  - Reel Scans per day
  - AI Analyses per day
  - Content Generation per day
  - Queue Size
  - Publishing (Instagram)
  - Analytics
  - API Access
  - Team Workspace

---

### `shared/components/saas/TierBadge.tsx`

**Current state**: Shows a badge like "Basic", "Pro", "Enterprise".

**What to change**: Nothing — tier names are product-agnostic.

---

## Summary Table

| File | Action | Priority |
|------|--------|----------|
| `calculator-interface.tsx` | Delete | After account tab removed |
| `usage-dashboard.tsx` | Update labels | Medium |
| `profile-editor.tsx` | Verify only | Low |
| `subscription-management.tsx` | Update tier features list | Medium |
| `order-detail-modal.tsx` | Check product names | Low |
| `dashboard-view.tsx` (admin) | Update KPI labels | Medium |
| `customers-view.tsx` (admin) | Check user detail metrics | Low |
| `PricingCard.tsx` | No change (update data source) | — |
| `UpgradePrompt.tsx` | Verify feature name rendering | Low |
| `FeatureComparison.tsx` | Replace comparison rows | High |
| `feature-gate.tsx` | Verify feature names | Low |
