# Subscription Cancellation During Trial - Troubleshooting Guide

## Overview

This guide explains how subscription cancellations during the trial period are handled and displayed in the admin dashboard.

## Question

**If users cancel their subscription before the trial period ends, will it be reflected on the admin dashboard?**

**Short Answer:** Yes, it should be reflected, but there are some important details to understand.

---

## How It Works

### 1. Stripe Subscription Lifecycle

When a user cancels a subscription during the trial period:

1. **Immediate Status Change:**
   - Stripe immediately changes the subscription status to `"canceled"`
   - The `canceled_at` timestamp is set to the current time
   - The subscription remains active until the trial period ends (user keeps access during trial)

2. **Trial Period Behavior:**
   - User retains access to premium features until `trial_end` date
   - No charge occurs at trial end
   - Subscription automatically ends when trial period expires

### 2. Firebase Stripe Extension Sync

The Firebase Stripe Extension automatically syncs subscription changes from Stripe to Firestore:

- **Webhook Events:** Stripe sends webhook events when subscriptions are canceled
- **Firestore Update:** Extension updates the subscription document in Firestore
- **Status Field:** The `status` field is updated to `"canceled"`
- **Canceled At:** The `canceled_at` timestamp is synced

**Firestore Path:** `customers/{userId}/subscriptions/{subscriptionId}`

### 3. Admin Dashboard Display

The admin dashboard queries all subscriptions from Firestore and displays them based on their status:

**Subscription List API:** `/api/admin/subscriptions`
- Queries **ALL** subscriptions from Firestore (no status filter by default)
- Includes canceled subscriptions
- Status filter can be applied via query parameter: `?status=canceled`

**Status Display:**
```tsx
// From subscriptions-list.tsx
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "active":
      return "default";
    case "trialing":
      return "secondary";
    case "past_due":
      return "destructive";
    case "canceled":  // ✅ Canceled status is supported
      return "outline";
    default:
      return "secondary";
  }
};
```

**Analytics API:** `/api/admin/subscriptions/analytics`
- Only counts `"active"` and `"trialing"` subscriptions for MRR/ARR generations
- Separately tracks `"canceled"` subscriptions in status distribution
- Calculates churn rate based on canceled subscriptions in last 30 days

---

## Current Implementation

### Subscription Status in Admin Dashboard

**✅ What Works:**
1. Canceled subscriptions are included in the subscription list
2. Status badge displays "canceled" with outline variant
3. Analytics tracks canceled subscriptions separately
4. Churn rate generation includes canceled subscriptions

**Code Reference:**
```typescript
// app/api/admin/subscriptions/route.ts
// Line 194: Status comes directly from Firestore
status: subData.status || "incomplete",

// Line 214: Status filter can be applied
if (status && status !== "all" && subscription.status !== status) {
  continue;
}
```

### Potential Issues

#### Issue 1: Status Not Updating Immediately

**Problem:**
If the Firebase Stripe Extension is not properly configured or webhooks are not working, the status might not update immediately in Firestore.

**Symptoms:**
- Subscription shows as "trialing" even after cancellation
- `canceled_at` field is null or missing
- Status doesn't change in admin dashboard

**Solution:**
1. Check Firebase Stripe Extension logs
2. Verify Stripe webhook configuration
3. Manually trigger sync if needed (see below)

#### Issue 2: Trial vs Canceled Status Confusion

**Problem:**
A subscription can be both "trialing" and "canceled" at the same time:
- Status: `"canceled"` (user canceled)
- Trial period: Still active (user has access until trial_end)

**Current Behavior:**
- Admin dashboard shows status as `"canceled"` (correct)
- User still has access until trial_end (expected behavior)
- Analytics counts it as canceled, not trialing (correct for MRR)

**This is correct behavior** - the status reflects the cancellation, not the trial state.

#### Issue 3: Analytics Counting

**Current Implementation:**
```typescript
// app/api/admin/subscriptions/analytics/route.ts
// Line 65-67: Only active and trialing count for MRR
const activeSubscriptions = allSubscriptions.filter(
  (sub) => sub.status === "active" || sub.status === "trialing"
);

// Line 98: Canceled subscriptions tracked separately
canceled: allSubscriptions.filter((s) => s.status === "canceled").length,
```

**This is correct** - canceled subscriptions should not count toward MRR, even if they're still in trial period.

---

## Verification Steps

### 1. Check Subscription Status in Admin Dashboard

1. Navigate to `/admin/subscriptions`
2. Look for subscriptions with status "canceled"
3. Verify `canceled_at` timestamp is present
4. Check if subscription was in trial when canceled

### 2. Verify Firestore Data

```typescript
// Check Firestore directly
const db = getFirestore();
const subscriptionRef = db
  .collection("customers")
  .doc(userId)
  .collection("subscriptions")
  .doc(subscriptionId);

const subscription = await subscriptionRef.get();
const data = subscription.data();

console.log({
  status: data.status, // Should be "canceled"
  canceled_at: data.canceled_at, // Should be timestamp
  trial_end: data.trial_end, // Trial end date
});
```

### 3. Check Stripe Dashboard

1. Go to Stripe Dashboard → Subscriptions
2. Find the subscription
3. Verify:
   - Status: `Canceled`
   - Canceled at: Timestamp
   - Trial end: Date (if trial was active)

### 4. Test Cancellation Flow

1. Create a test subscription with trial
2. Cancel it immediately (before trial ends)
3. Wait for webhook to process (usually < 1 minute)
4. Check admin dashboard:
   - Status should show "canceled"
   - `canceled_at` should be populated
   - Should still appear in subscription list

---

## Troubleshooting

### Problem: Canceled Subscription Not Showing in Admin Dashboard

**Possible Causes:**
1. Firebase Extension not syncing
2. Webhook not configured
3. Status filter applied (default shows all)

**Solutions:**

1. **Check Firebase Extension:**
   ```bash
   # Check extension logs
   firebase functions:log --only extensions
   ```

2. **Verify Webhook Configuration:**
   - Stripe Dashboard → Developers → Webhooks
   - Ensure `customer.subscription.updated` and `customer.subscription.deleted` events are enabled
   - Verify webhook endpoint points to Firebase Extension

3. **Manual Sync (if needed):**
   ```typescript
   // Trigger manual sync via Stripe API
   // This is usually not needed - Extension handles it automatically
   ```

4. **Check Status Filter:**
   - Admin dashboard should show all subscriptions by default
   - If status filter is applied, canceled subscriptions might be hidden
   - Remove filter or select "all" to see canceled subscriptions

### Problem: Status Shows "trialing" After Cancellation

**Possible Causes:**
1. Webhook not received yet (wait a few minutes)
2. Firebase Extension error
3. Stripe webhook not configured

**Solutions:**

1. **Wait for Sync:**
   - Webhooks typically process within 1-2 minutes
   - Check again after waiting

2. **Check Extension Status:**
   ```bash
   firebase ext:list
   # Verify Stripe Extension is installed and active
   ```

3. **Manually Check Stripe:**
   - If Stripe shows "canceled" but Firestore shows "trialing"
   - This indicates a sync issue
   - Check Firebase Extension logs

### Problem: Canceled Subscription Still Counted in MRR

**This should not happen** - the analytics API correctly filters out canceled subscriptions:

```typescript
// Only active and trialing count for MRR
const activeSubscriptions = allSubscriptions.filter(
  (sub) => sub.status === "active" || sub.status === "trialing"
);
```

If this is happening, check:
1. Status field in Firestore is actually "canceled"
2. Analytics API is using the correct filter
3. No caching issues

---

## Best Practices

### 1. Display Canceled Subscriptions

**Recommendation:** Show canceled subscriptions in admin dashboard with clear visual distinction:

```tsx
// Enhanced status display
{subscription.status === "canceled" && subscription.trialEnd && 
  new Date(subscription.trialEnd) > new Date() && (
    <Badge variant="outline">
      Canceled (Trial Active Until {formatDate(subscription.trialEnd)})
    </Badge>
  )}
```

### 2. Filter Options

Provide filter options in admin dashboard:
- "All" (default) - shows all subscriptions
- "Active" - only active and trialing
- "Canceled" - only canceled subscriptions
- "Trialing" - only trialing subscriptions

### 3. Analytics Clarity

Make it clear in analytics:
- MRR/ARR only includes active subscriptions
- Canceled subscriptions are tracked separately
- Churn rate includes cancellations during trial

### 4. Monitoring

Set up alerts for:
- High cancellation rate during trial
- Sync failures between Stripe and Firestore
- Webhook delivery failures

---

## Related Documentation

- [Subscription Architecture](../architecture/domain/subscription-architecture.md)
- [Firebase Integration](../architecture/domain/firebase-integration.md)
- [Admin Dashboard](../architecture/domain/admin-dashboard.md)

---

## Summary

**Answer to Original Question:**

✅ **Yes, canceled subscriptions during trial ARE reflected in the admin dashboard:**

1. Status shows as "canceled" (not "trialing")
2. `canceled_at` timestamp is populated
3. Subscription appears in subscription list
4. Analytics tracks it separately (not counted in MRR)
5. Churn rate includes these cancellations

**Important Notes:**
- User retains access until trial_end (expected behavior)
- Status reflects cancellation, not trial state
- Analytics correctly excludes canceled subscriptions from MRR
- If status doesn't update, check Firebase Extension sync

---

*Last Updated: December 2025*
