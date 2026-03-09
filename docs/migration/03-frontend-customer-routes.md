# Frontend Customer Routes Migration

Files in `frontend/src/routes/(customer)/`.

---

## `src/routes/(customer)/account.tsx`

**Current state**: Thin wrapper that loads `AccountInteractive`. No brand text here — safe as-is.

**What must change**: Nothing in this file directly.

---

## `src/routes/(customer)/account/-account-interactive.tsx`

**Current state**: The main account dashboard. Has 5 tabs:
1. **Calculator** (`account_tabs_calculator`) — shows `CalculatorInterface` (already a stub that redirects to studio)
2. **Subscription** — shows `SubscriptionManagement`
3. **Usage** — shows `UsageDashboard`
4. **Orders** — shows order history
5. **Profile** — shows `ProfileEditor`

**What must change**:
- Remove the "Calculator" tab entirely — it is a dead stub and confusing
- Rename / restructure tabs to be ReelStudio-relevant:
  1. **Overview** — summary dashboard: generation count, queue count, recent reels analyzed
  2. **Subscription** — unchanged (Stripe billing management)
  3. **Usage** — unchanged (API/feature usage stats)
  4. **Orders** — unchanged (purchase history)
  5. **Profile** — unchanged (name, email, phone)
- The "Overview" tab should link to `/studio/discover` as the primary CTA and show quick stats from the ReelStudio API

### Translation keys involved:
- `account_tabs_calculator` → remove or repurpose as `account_tabs_overview`
- `account_tabs_calculator_short` → remove or repurpose
- All other tab keys stay the same

### Imports to change:
- Remove: `import { CalculatorInterface } from "@/features/account/components/calculator-interface"`
- Add: A new `AccountOverview` component (or inline overview content)

---

## `src/features/account/components/calculator-interface.tsx`

**Current state**: Stub component that shows a message and links to `/studio/discover`. Created during previous migration.

**What to do**: **Delete this file entirely** once the Calculator tab is removed from the account page. It has no purpose.

---

## `src/features/account/components/usage-dashboard.tsx`

**Current state**: Shows usage statistics. Previously tracked calculator usage (mortgage, loan, investment calculations per month). The component already had calculator-specific imports removed in a previous pass, but the UI labels likely still reference calculators.

**What must change**:
- Read the file and find any hardcoded "calculation", "calculator type" labels
- Replace with ReelStudio usage metrics:
  - Reels analyzed this month
  - Content pieces generated this month
  - Queue items scheduled
  - API calls (if applicable)
- The underlying `featureUsages` table is already generic — just the display labels need updating

### Translation keys to check in this component:
- Any `account_usage_*` keys — audit and update as needed

---

## `src/routes/(customer)/checkout.tsx` and `-checkout-interactive.tsx`

**Current state**: Stripe checkout flow. Fully functional. Collects payment info and processes subscription.

**What must change**:
- **Minimal changes** — the payment flow itself is product-agnostic
- Check for any calculator-specific text in the checkout summary or plan descriptions
- The plan descriptions (what you get per tier) should reference ReelStudio features, not calculators
- Check `subscription.constants.ts` for tier feature descriptions

---

## `src/routes/(customer)/payment/index.tsx`

**Current state**: Payment redirect/processing page.

**What must change**: Check for any calculator references. Likely none — this is just a loading/redirect state.

---

## `src/routes/(customer)/payment/cancel.tsx`

**Current state**: Payment cancellation page. Shows a "payment cancelled" message and links back.

**What must change**:
- Verify the "go back" link points to `/pricing` not `/calculator` or anything calculator-related
- Check the translation keys used for calculator mentions

---

## `src/routes/(customer)/payment/success/index.tsx` and `-payment-success-interactive.tsx`

**Current state**: Payment success page. Confirms subscription activation and provides next steps.

**What must change**:
- CTA after success: "Start using ReelStudio" → links to `/studio/discover`
- Remove any "Start calculating" or "access your calculators" text
- The `order-confirmation.tsx` component already has one link fixed from `/calculator` to `/studio/discover` (done in this session)

---

## `src/features/payments/components/success/order-confirmation.tsx`

**Current state**: Partially fixed — the `/calculator` link was updated to `/studio/discover` in this session.

**What must change**:
- Read the full component to verify no other calculator references remain
- The "Browse More" button text was changed from "Browse More Therapies" to "Go to Studio" — verify this is consistent with the product
- Check all body text for any CalcPro mentions
