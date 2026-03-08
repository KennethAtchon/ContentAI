# Troubleshooting: Missing stripeRole Custom Claim

## Problem

After completing a subscription checkout, the `stripeRole` custom claim is not appearing in the Firebase ID token, even though:
- The subscription exists in Firestore (`customers/{userId}/subscriptions/{subscriptionId}`)
- The subscription is valid and active in Stripe
- The checkout session was completed successfully

## Root Cause

The Firebase Stripe Extension requires **metadata on Stripe products or prices** to know which role to assign. Without this metadata, the Extension cannot set the `stripeRole` custom claim.

## Solution

### Step 1: Add Metadata to Stripe Products

The Firebase Stripe Extension looks for metadata with the key `firebaseRole` (or `role`) on your Stripe products or prices.

**Option A: Add metadata to Products (Recommended)**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Products
2. For each product, click to edit
3. Scroll to the **Metadata** section
4. Add a metadata entry:
   - **Key:** `firebaseRole`
   - **Value:** `basic`, `pro`, or `enterprise` (depending on the tier)

**Option B: Add metadata to Prices**

If you prefer to set metadata on prices instead:
1. Go to Stripe Dashboard → Products → Select product → Prices
2. Click on each price
3. Add metadata:
   - **Key:** `firebaseRole`
   - **Value:** `basic`, `pro`, or `enterprise`

### Step 2: Map Your Products to Roles

Based on your `stripe.constants.ts`, here's what metadata you need:

| Product ID | Product Name | Metadata Value |
|------------|--------------|----------------|
| `prod_TWTXj1UeJcW6vz` | Tier 1 | `firebaseRole: "basic"` |
| `prod_TWTYPXmd7zh3kP` | Tier 2 | `firebaseRole: "pro"` |
| `prod_TWTYPkmPHd8GF4` | Tier 3 | `firebaseRole: "enterprise"` |

### Step 3: Verify Extension Configuration

1. Go to [Firebase Console](https://console.firebase.google.com) → Extensions
2. Find the `firestore-stripe-payments` extension
3. Click to view configuration
4. Verify that **"Sync Custom Claims"** is enabled
5. Check that the extension is using the correct Stripe secret key

### Step 4: Test with Existing Subscription

After adding metadata, existing subscriptions won't automatically update. You have two options:

**Option A: Wait for Next Webhook Event**
- The Extension will update custom claims on the next subscription event (renewal, update, etc.)
- This may take time depending on your billing cycle

**Option B: Manually Trigger Update (Recommended for Testing)**

1. In Stripe Dashboard, go to the subscription
2. Make a small change (e.g., update metadata, then revert it)
3. This triggers a `subscription.updated` webhook
4. The Extension will process the webhook and update custom claims

**Option C: Create a New Test Subscription**
- Create a new subscription with a test account
- The Extension should immediately set the `stripeRole` claim

### Step 5: Verify Custom Claims Are Set

**Client-Side Check:**

```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  // Force refresh to get latest claims
  await user.getIdToken(true);
  
  const tokenResult = await user.getIdTokenResult();
  console.log('stripeRole:', tokenResult.claims.stripeRole);
  // Should output: 'basic', 'pro', or 'enterprise'
}
```

**Server-Side Check:**

```typescript
import { adminAuth } from '@/shared/services/firebase/admin';

const decodedToken = await adminAuth.verifyIdToken(idToken);
console.log('stripeRole:', decodedToken.stripeRole);
```

## Common Issues

### Issue 1: Extension Not Processing Webhooks

**Symptoms:**
- Subscriptions exist in Stripe but not in Firestore
- No subscription documents in `customers/{userId}/subscriptions/`

**Solution:**
1. Check Firebase Console → Extensions → `firestore-stripe-payments` → Logs
2. Verify webhook endpoint is configured in Stripe Dashboard
3. Check Stripe Dashboard → Developers → Webhooks for failed deliveries

### Issue 2: Wrong Metadata Key

**Symptoms:**
- Extension processes webhooks but `stripeRole` is still missing

**Solution:**
- Ensure metadata key is exactly `firebaseRole` (case-sensitive)
- Alternative key `role` may also work depending on Extension version
- Check Extension documentation for your specific version

### Issue 3: Multiple Active Subscriptions

**Symptoms:**
- User has multiple subscriptions, Extension doesn't know which role to use

**Solution:**
- The Extension typically uses the subscription with the highest tier
- Ensure only one active subscription per user, or configure Extension to handle multiple subscriptions

### Issue 4: Token Not Refreshing

**Symptoms:**
- Metadata is set in Stripe, Extension logs show claims being set, but client still doesn't see `stripeRole`

**Solution:**
- Force token refresh: `await user.getIdToken(true)`
- Wait a few seconds after subscription creation for Extension to process
- Check token expiration - claims are cached until token expires

## Verification Checklist

- [ ] Metadata `firebaseRole` added to all Stripe products
- [ ] Extension "Sync Custom Claims" is enabled
- [ ] Extension is using correct Stripe secret key
- [ ] Webhook endpoint is configured in Stripe
- [ ] Test subscription created after adding metadata
- [ ] Token refreshed on client: `getIdToken(true)`
- [ ] `stripeRole` appears in `tokenResult.claims.stripeRole`

## Quick Fix Script

If you need to manually set custom claims for existing users (not recommended for production, but useful for testing):

```typescript
// ⚠️ WARNING: This bypasses the Extension. Only use for testing!
import { adminAuth } from '@/shared/services/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

async function manuallySetStripeRole(userId: string, role: 'basic' | 'pro' | 'enterprise') {
  await adminAuth.setCustomUserClaims(userId, { stripeRole: role });
  console.log(`Set stripeRole=${role} for user ${userId}`);
}

// Usage:
// manuallySetStripeRole('user123', 'pro');
```

**Note:** This is a temporary workaround. The Extension should handle this automatically once metadata is configured correctly.

## Related Documentation

- [Firebase Integration](./architecture/domain/firebase-integration.md)
- [Subscription Architecture](./architecture/domain/subscription-architecture.md)
- [Payment Flows](./architecture/domain/payment-flows.md)

---

*Last Updated: Based on Firebase Stripe Extension v0.0.8*

