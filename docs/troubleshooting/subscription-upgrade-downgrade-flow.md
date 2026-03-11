# Subscription Upgrade/Downgrade Flow - How It Actually Works

## Overview

This document explains what actually happens when users upgrade or downgrade their subscriptions in your app, and how Stripe handles these changes behind the scenes.

**Important:** As of January 2026, ALL subscription plan changes must go through the Stripe Customer Portal. The pricing page and checkout flow are only for creating NEW subscriptions. Users with existing subscriptions cannot use checkout to change plans - they must use the portal.

---

## The Confusion: "Taking You Through the Flow Again"

You mentioned that users "just take you through the flow again" - this is a common point of confusion. Here's what's actually happening:

**The Stripe Customer Portal is NOT creating a new subscription.** Instead, it's **modifying the existing subscription** in place. The "flow" you see is Stripe's UI for managing the subscription change, but it's not the same as the initial checkout flow.

---

## What Stripe Actually Does

### When a User Changes Tiers in Stripe Portal

Stripe modifies the **existing subscription object** by:

1. **Updating the subscription item** - Changes the `price_id` from the old tier to the new tier
2. **Calculating proration** - Determines how much to charge/credit based on:
   - Time remaining in current billing period
   - Price difference between tiers
   - Your proration settings
3. **Creating an invoice** - Generates an invoice for the prorated amount (if upgrading) or credits the account (if downgrading)
4. **Updating subscription metadata** - Preserves your custom metadata (tier, billingCycle, etc.)

### Key Point: Same Subscription, Different Price

```
Before: subscription_123 → price_basic_monthly ($9/mo)
After:  subscription_123 → price_pro_monthly ($29/mo)
```

The subscription ID stays the same! Only the price/item changes.

---

## How It Works in Your App

### Current Architecture (Post-Refactor)

**Key Principle:** All plan changes go through Stripe Customer Portal. Pricing page is only for NEW subscriptions.

### Step-by-Step Flow for Plan Changes

```
1. User with existing subscription clicks "Manage Subscription" or "Upgrade" button
   ↓
2. Your app uses usePortalLink() hook (SWR-cached)
   ↓
3. Hook calls /api/subscriptions/portal-link (POST)
   ↓
4. Firebase Extension creates Stripe Portal session
   ↓
5. User redirected to Stripe Customer Portal (hosted by Stripe)
   ↓
6. User selects new tier in Stripe Portal UI
   ↓
7. Stripe modifies the existing subscription:
   - Updates subscription.items[0].price.id
   - Calculates proration
   - Creates invoice/credit
   - Sends webhook: customer.subscription.updated
   ↓
8. Firebase Extension receives webhook
   ↓
9. Extension updates Firestore:
   - Updates subscription document
   - Extracts new tier from metadata
   - Updates Firebase Auth custom claim (stripeRole)
   ↓
10. User redirected back to your app (/account)
    ↓
11. Your app refreshes Firebase token
    ↓
12. User sees new tier immediately
```

### Flow for New Subscriptions

```
1. User WITHOUT subscription visits /pricing
   ↓
2. User clicks "Get Started" on a pricing card
   ↓
3. User redirected to /checkout?tier={tier}&billing={cycle}
   ↓
4. Checkout protection checks: No existing subscription? ✅
   ↓
5. SubscriptionCheckout component creates new subscription
   ↓
6. User completes Stripe Checkout
   ↓
7. New subscription created
```

### Protection Against Duplicate Subscriptions

**Checkout Protection:**
- `checkout-interactive.tsx` checks for existing subscription before allowing checkout
- `subscription-checkout.tsx` validates no existing subscription before creating session
- If user has subscription, they're redirected to `/account` with message to use portal

**Pricing Page Behavior:**
- Pricing page is always accessible (no redirects)
- Pricing cards check subscription status
- If user has subscription: Button routes to portal
- If user has no subscription: Button routes to checkout

---

## Stripe Subscription Modification Details

### What Gets Changed

When a user upgrades/downgrades, Stripe modifies:

```javascript
// Subscription object (simplified)
{
  id: "sub_123abc",  // ← STAYS THE SAME
  customer: "cus_xyz",
  status: "active",
  items: {
    data: [{
      id: "si_old123",
      price: {
        id: "price_basic_monthly",  // ← CHANGES TO new price
        amount: 900,  // ← CHANGES TO new amount
      }
    }]
  },
  metadata: {
    tier: "basic",  // ← CHANGES TO new tier
    billingCycle: "monthly"
  },
  current_period_start: 1234567890,  // ← STAYS THE SAME
  current_period_end: 1234567890,    // ← STAYS THE SAME (usually)
  // ... other fields
}
```

### Proration Behavior

**Upgrades (Basic → Pro):**
- **Immediate effect** (default)
- User charged prorated amount: `(new_price - old_price) × (days_remaining / total_days)`
- Example: Upgrade halfway through month
  - Old: $9/mo, New: $29/mo
  - Difference: $20
  - Prorated: $20 × 0.5 = $10 charged immediately
  - Next billing: Full $29

**Downgrades (Pro → Basic):**
- **End of period effect** (default)
- User keeps Pro features until period ends
- No immediate charge/credit
- Next billing: Full $9

**You can configure this** in Stripe Portal settings or via API.

---

## Firebase Extension's Role

### What the Extension Does Automatically

When Stripe sends the `customer.subscription.updated` webhook:

1. **Updates Firestore Document**
   ```javascript
   // Firestore: customers/{uid}/subscriptions/{subId}
   {
     status: "active",
     items: { data: [{ price: { id: "price_pro_monthly" } }] },
     metadata: { tier: "pro", billingCycle: "monthly" },
     // ... other fields synced from Stripe
   }
   ```

2. **Updates Firebase Auth Custom Claim**
   ```javascript
   // Sets custom claim on user's Firebase Auth token
   setCustomUserClaims(uid, {
     stripeRole: "pro"  // ← Extracted from metadata.tier
   })
   ```

3. **No Manual Code Needed**
   - Extension handles all webhook processing
   - Extension extracts tier from metadata
   - Extension updates custom claims automatically

---

## Why It Feels Like "Going Through the Flow Again"

### The Stripe Portal UI

The Stripe Customer Portal shows:
- Current subscription details
- Available plans to switch to
- Price differences
- Proration generations
- Confirmation screens

This **looks similar** to checkout, but it's actually:
- **Modifying** an existing subscription (not creating new)
- **Using the same subscription ID**
- **Preserving billing history**

### Visual Similarity ≠ Functional Similarity

```
Checkout Flow (New Subscription):
  → Creates NEW subscription
  → New subscription ID
  → New billing cycle starts
  → Full payment required

Portal Flow (Modify Existing):
  → Modifies EXISTING subscription
  → Same subscription ID
  → Same billing cycle (usually)
  → Prorated payment/credit
```

---

## What Happens to Billing

### Upgrade Scenario

**User on Basic ($9/mo), upgrades to Pro ($29/mo) mid-month:**

```
Day 1-15:  Basic subscription ($9/mo)
Day 15:    User upgrades to Pro
Day 15:    Stripe charges prorated amount:
           ($29 - $9) × (15 days / 30 days) = $10
Day 16-30: User has Pro access
Day 30:    Next billing cycle starts
Day 30:    Stripe charges full $29 for next month
```

### Downgrade Scenario

**User on Pro ($29/mo), downgrades to Basic ($9/mo) mid-month:**

```
Day 1-15:  Pro subscription ($29/mo)
Day 15:    User downgrades to Basic
Day 15-30: User STILL has Pro access (until period ends)
Day 30:    Subscription switches to Basic
Day 30:    Next billing: $9 (no charge for downgrade)
```

---

## How Your App Detects Changes

### Token Refresh Pattern

After user returns from Stripe Portal:

```typescript
// In your app (subscription-management.tsx or similar)
const user = auth.currentUser;
await user.getIdToken(true);  // Force refresh
const tokenResult = await user.getIdTokenResult();
const stripeRole = tokenResult.claims.stripeRole;  // ← Updated tier
```

The custom claim is updated by Firebase Extension, so refreshing the token gives you the new tier immediately.

### API Endpoint Check

Your `/api/subscriptions/current` endpoint:
1. Queries Firestore for active subscriptions
2. Extracts tier from `metadata.tier`
3. Returns current subscription details

This will show the updated tier after the webhook processes.

---

## Important Differences: New Subscription vs. Modification

### Creating a New Subscription (Checkout Flow)

**When Used:**
- User has NO existing subscription
- User visits `/pricing` and clicks "Get Started"
- Checkout protection validates no existing subscription

```javascript
// What happens:
POST /v1/checkout/sessions
{
  mode: "subscription",
  price: "price_pro_monthly",
  customer: "cus_existing"  // or creates new customer
}

// Result:
- NEW subscription created (sub_new123)
- User has ONE subscription (correct!)
```

**Protection:**
- Checkout is blocked if user already has subscription
- User redirected to account page with message to use portal

### Modifying Existing Subscription (Portal Flow)

**When Used:**
- User HAS existing subscription
- User clicks "Manage Subscription" or any "Upgrade" button
- All plan changes must use portal

```javascript
// What happens:
PUT /v1/subscriptions/sub_existing
{
  items: [{ price: "price_pro_monthly" }]
}

// Result:
- SAME subscription (sub_existing)
- Price/item updated
- User has ONE subscription (correct!)
```

**Why This Matters:**
- Prevents duplicate subscriptions
- Preserves subscription history
- Proper proration handling
- Maintains billing continuity

---

## Trial Period Behavior

**Users CAN access the Stripe Customer Portal during trial AND switch plans.**

**What users CAN do during trial:**
- Switch subscription tiers/plans (enabled)
- Update payment method (important for when trial ends)
- View subscription details and billing history
- Cancel subscription
- Update billing address

**Plan Switching During Trial:**
- When a user switches to a plan that includes a trial, Stripe adds the full trial duration of the new plan
- Example: User on Day 10 of Basic trial switches to Pro → gets full Pro trial period
- No charges occur during trial, regardless of plan changes
- Our trial eligibility check prevents abuse by ensuring users can only have one trial period total
- The `hasUsedFreeTrial` flag in the database tracks if a user has ever used a trial, preventing new trial subscriptions after the first one

**Configuration:**
- The portal is configured to allow subscription updates via the `features.subscription_update` parameter
- If the Firebase Extension doesn't support passing features directly, ensure the Stripe Customer Portal in your Stripe Dashboard is configured to allow subscription updates
- Portal configuration: Stripe Dashboard → Settings → Billing → Customer Portal → Subscription management → Allow customers to update subscriptions

**Why Allow Plan Switching:**
- Better user experience - users can explore different tiers during trial
- Higher conversion - users find the right tier before paying
- No payment risk - no charges during trial anyway
- Trial abuse prevented by existing eligibility checks

---

## Summary

### What Actually Happens (Plan Changes)

1. **User clicks "Manage Subscription" or "Upgrade"** → Portal link fetched (SWR-cached)
2. **User redirected to Stripe Customer Portal**
3. **Stripe modifies the existing subscription** (same ID)
4. **Proration is calculated** based on time remaining
5. **Invoice/credit is created** for the difference
6. **Webhook fires** to Firebase Extension
7. **Extension updates** Firestore + Firebase Auth
8. **Your app sees** the new tier via token refresh

### What Does NOT Happen

- ❌ New subscription is NOT created (when changing plans)
- ❌ Old subscription is NOT deleted
- ❌ User does NOT go through checkout flow for plan changes
- ❌ Billing cycle does NOT reset (usually)
- ❌ Duplicate subscriptions are NOT created (protected by checkout validation)

### The "Flow" You See

The Stripe Portal UI looks like checkout, but it's actually:
- A **management interface** for existing subscriptions
- **Modifying** the current subscription
- **Preserving** subscription history and billing

### Architecture Principles

1. **Pricing page is for NEW subscriptions only**
   - Users without subscriptions → Checkout flow
   - Users with subscriptions → Portal link (buttons route intelligently)

2. **All plan changes go through portal**
   - No upgrade/downgrade logic in pricing components
   - All "upgrade" buttons route to portal if subscription exists

3. **Checkout is protected**
   - Validates no existing subscription before allowing checkout
   - Prevents duplicate subscription creation

4. **Portal link is cached**
   - SWR automatically caches portal links
   - Reduces API calls and improves performance

---

## Testing This Flow

### To Verify It's Working

1. **Check Stripe Dashboard:**
   - Go to customer's subscription
   - Look at subscription ID before/after change
   - Should be the SAME ID

2. **Check Firestore:**
   - Look at `customers/{uid}/subscriptions/{subId}`
   - `metadata.tier` should update
   - Subscription ID should stay same

3. **Check Firebase Auth:**
   - User's custom claim `stripeRole` should update
   - Token refresh should show new tier

4. **Check Your App:**
   - `/api/subscriptions/current` should return new tier
   - UI should reflect new tier immediately

---

## Related Documentation

- [Subscription Portal-Only Refactor Plan](../plantofix/subscription-portal-only-refactor.md) - Complete refactor documentation
- [Subscription System Architecture](../architecture/domain/subscription-system.md)
- [Business Model](../architecture/domain/business-model.md)
- [Stripe Subscription Updates (Official Docs)](https://docs.stripe.com/billing/subscriptions/change-price)

## Implementation Details

### Components Updated (January 2026)

- `PricingCard.tsx` - Removed upgrade/downgrade logic, added subscription-aware routing
- `pricing-interactive.tsx` - Removed subscription detection, simplified to billing cycle toggle
- `subscription-management.tsx` - Removed upgrade/change plan buttons, only "Manage Subscription" remains
- `upgrade-prompt.tsx` - Checks subscription status, routes to portal if exists
- `checkout-interactive.tsx` - Added protection against duplicate subscriptions
- `subscription-checkout.tsx` - Validates no existing subscription before checkout
- `usePortalLink()` hook - New SWR-based hook for portal link caching

### Portal Link Caching

The `usePortalLink()` hook uses SWR to automatically:
- Cache portal links for 5 minutes
- Deduplicate requests (multiple components = one API call)
- Handle loading and error states
- Provide refresh function if needed

---

*Last Updated: January 2026 - Updated to reflect portal-only architecture*
