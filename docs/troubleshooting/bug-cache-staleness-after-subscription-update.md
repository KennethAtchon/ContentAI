# Bug: Stale UI After Subscription Upgrade

## Summary

After a user completes the Stripe upgrade flow and returns to the app, several parts of the UI continue to show outdated data (old plan limits, old usage numbers, old usage stats on the generate page). The cache invalidation that runs on role change has gaps, and the portal link is also never refreshed after a portal visit.

## Root Cause

There are two independent gaps in the cache invalidation logic.

---

## Gap 1: `usageStats` query is excluded from role-change invalidation

**File:** `frontend/src/features/subscriptions/hooks/use-subscription.ts:86–97`

```ts
queryClient.invalidateQueries({
  predicate: (query) => {
    const key = query.queryKey;
    if (!Array.isArray(key) || key[0] !== "api") return false;
    const path = key.join("/");
    return (
      path.includes("admin/subscriptions") ||
      path.includes("reels/usage") ||
      path.includes("subscriptions")
    );
  },
});
```

The predicate joins the key array with `/` and does substring matching. The usage stats query (shown on the generate page and account page) has the key:

```ts
queryKeys.api.usageStats()  // → ["api", "account", "usage"]
// path → "api/account/usage"
```

This path does **not** match `"admin/subscriptions"`, `"reels/usage"`, or `"subscriptions"`, so it is **never invalidated** when the subscription role changes. The generate page continues to show old stats after an upgrade until a hard refresh.

### Fix for Gap 1

Add `"account/usage"` to the predicate:

```ts
return (
  path.includes("admin/subscriptions") ||
  path.includes("reels/usage") ||
  path.includes("subscriptions") ||
  path.includes("account/usage")   // ← add this
);
```

Alternatively, replace the string-matching predicate with explicit key invalidations for clarity and safety:

```ts
queryClient.invalidateQueries({ queryKey: queryKeys.api.reelsUsage() });
queryClient.invalidateQueries({ queryKey: queryKeys.api.usageStats() });
queryClient.invalidateQueries({ queryKey: queryKeys.api.currentSubscription() });
```

Using explicit `queryKeys` references is safer — it breaks at compile time if a key is renamed, rather than silently failing at runtime.

---

## Gap 2: Portal link is never refreshed after a portal visit

**File:** `frontend/src/shared/hooks/use-portal-link.ts:55`

```ts
staleTime: QUERY_STALE.long,  // 5 minutes
gcTime: QUERY_STALE.long,
```

The Stripe Customer Portal URL is cached for 5 minutes. When a user visits the portal to upgrade/downgrade and returns to the app, the role-change invalidation in `useSubscription` does not include the portal link key:

```ts
queryKeys.api.portalLink()  // → ["api", "subscriptions", "portal-link"]
// path → "api/subscriptions/portal-link"
// This DOES match "subscriptions" — so it IS invalidated on role change. ✓
```

Wait — actually the path `"api/subscriptions/portal-link"` **does** contain `"subscriptions"`, so this one is already handled. ✓

The real problem is a different stale-time scenario: if the role has NOT changed (e.g. the user visits the portal but doesn't actually change their plan, or the Stripe webhook is delayed and the Firebase token hasn't refreshed yet), the portal link stays cached but the invalidation never fires because `previousRole === newRole`.

### Fix for Gap 2

Reduce `staleTime` for the portal link to `0` or a short value (30s), since portal links are Stripe-generated URLs that expire and should never be cached long:

```ts
staleTime: 0,       // always fetch fresh
gcTime: 5 * 60 * 1000,
```

---

## Gap 3: No cache invalidation after successful checkout (payment/success page)

**File:** `frontend/src/routes/(customer)/payment/success/-payment-success-interactive.tsx`

After a Stripe Checkout Session completes, the user is redirected to `/payment/success`. At this point the subscription has changed, but the payment success page likely does not invalidate subscription/usage caches because it relies on the `useSubscription` hook's `onAuthStateChanged` listener to eventually fire.

The problem: Firebase custom claims (which carry the `stripeRole`) are set by the Stripe Firebase Extension via a webhook. The webhook processing can take 2–30 seconds after the Stripe session completes. The user lands on `/payment/success`, the `onAuthStateChanged` fires immediately (no claim change yet), and `previousRole === newRole` so no invalidation runs. Minutes later the role finally changes, the listener fires again, and caches are invalidated.

### Fix for Gap 3

On the payment success page, proactively invalidate all subscription-related caches AND set a polling interval to force-refresh the Firebase token every few seconds until the role changes:

```ts
// In payment success component
useEffect(() => {
  // Eagerly invalidate so the page shows fresh data when the role arrives
  queryClient.invalidateQueries({ queryKey: queryKeys.api.usageStats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.api.reelsUsage() });
  queryClient.invalidateQueries({ queryKey: queryKeys.api.currentSubscription() });

  // Poll for role change (Stripe webhook may take up to 30s)
  const interval = setInterval(async () => {
    const user = getAuth().currentUser;
    if (user) {
      await user.getIdToken(true); // force refresh
      const result = await user.getIdTokenResult();
      if (result.claims.stripeRole) {
        clearInterval(interval);
        // The useSubscription hook will pick this up via onAuthStateChanged
      }
    }
  }, 3000);

  return () => clearInterval(interval);
}, [queryClient]);
```

---

## Summary of All Cache Invalidation Gaps

| Query Key | After Role Change | After Limit Hit (403) | After Portal Return |
|---|---|---|---|
| `["api", "reels", "usage"]` | ✓ Yes | ✓ Yes | ✓ (if role changed) |
| `["api", "account", "usage"]` | ✗ **Missing** | ✓ Yes | ✗ **Missing** |
| `["api", "subscriptions", "current"]` | ✓ Yes | ✗ No | ✓ (if role changed) |
| `["api", "subscriptions", "portal-link"]` | ✓ Yes | ✗ No | ✓ (if role changed) |

## Verification

1. Log in as a basic user.
2. Complete the Stripe upgrade flow to pro/enterprise.
3. Return to the generate page immediately.
4. Confirm the usage stats reflect the new plan's limits without requiring a hard refresh.
5. Confirm the generate page updates within ~5 seconds (during the Stripe webhook delay window).
