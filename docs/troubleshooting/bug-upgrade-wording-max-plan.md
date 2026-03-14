# Bug: "Upgrade Plan" Wording Shows for Max Plan (Enterprise)

## Summary

Enterprise users on the highest plan still see "Upgrade plan" / "Upgrade →" CTAs in the chat limit warning banner, the limit-reached inline banner, and the limit hit modal. There is no upgrade they can take — the messaging is nonsensical and undermines trust.

## Root Cause

The `useSubscription` hook at `frontend/src/features/subscriptions/hooks/use-subscription.ts:142` correctly computes `hasEnterpriseAccess: role === "enterprise"`, but **none of the limit/warning UI components consume this flag**. All four places render upgrade CTAs unconditionally, without checking whether the user is already on the top tier.

## Affected Files

| File | Line(s) | Issue |
|------|---------|-------|
| `frontend/src/features/chat/components/UsageWarningBanner.tsx` | 54–59 | Always renders "Upgrade plan" link to `/pricing` |
| `frontend/src/features/chat/components/ChatPanel.tsx` | 120–125 | Always renders "Upgrade →" link to `/pricing` when limit reached |
| `frontend/src/features/chat/components/LimitHitModal.tsx` | 35 | Always renders "View plans" link to `/pricing` |
| `frontend/src/features/account/components/subscription-management.tsx` | 171–178 | Alert says "Use Manage Subscription to change your plan" even for max plan |

## Detailed Breakdown

### UsageWarningBanner (80% threshold banner)

`UsageWarningBanner.tsx:54–59`:
```tsx
<a href="/pricing" ...>
  {t("studio_chat_usageWarning_upgrade")}  {/* → "Upgrade plan" */}
</a>
```

This shows at 80%–99% usage for **any tier**. Enterprise users see it and click a pricing page they can't do anything on.

### ChatPanel (100% / limit-reached inline banner)

`ChatPanel.tsx:120–125`:
```tsx
<a href="/pricing" ...>
  {t("studio_chat_limit_upgrade")}  {/* → "Upgrade →" */}
</a>
```

Shown when `isLimitReached` is true, regardless of plan.

### LimitHitModal

`LimitHitModal.tsx:35`:
```tsx
<a href="/pricing">{t("studio_chat_limitModal_upgrade")}</a>  {/* → "View plans" */}
```

Shown on any `USAGE_LIMIT_REACHED` 403 response.

## Fix Plan

### 1. Pass `hasEnterpriseAccess` to limit UI components

In `ChatLayout.tsx`, import `useSubscription` and pass a prop down:

```tsx
const { hasEnterpriseAccess } = useSubscription();
// ...
<ChatPanel
  ...
  isMaxPlan={hasEnterpriseAccess}
/>
```

### 2. Update `UsageWarningBanner`

`UsageWarningBanner` is self-contained (fetches its own data). Add a `useSubscription()` call inside it:

```tsx
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";

export function UsageWarningBanner() {
  const { hasEnterpriseAccess } = useSubscription();
  // ...

  return (
    // ...
    {hasEnterpriseAccess ? (
      <span className="text-[10px] font-semibold ...">
        {t("studio_chat_usageWarning_contactSupport")}
      </span>
    ) : (
      <a href="/pricing" ...>
        {t("studio_chat_usageWarning_upgrade")}
      </a>
    )}
    // ...
  );
}
```

### 3. Update `ChatPanel`

Add `isMaxPlan?: boolean` prop and branch the CTA:

```tsx
{isLimitReached && (
  <div className="...">
    <span>{t("studio_chat_limit_reached")}</span>
    {isMaxPlan ? (
      <span className="...">{t("studio_chat_limit_maxPlan")}</span>
    ) : (
      <a href="/pricing" ...>{t("studio_chat_limit_upgrade")}</a>
    )}
  </div>
)}
```

### 4. Update `LimitHitModal`

Add `isMaxPlan?: boolean` prop:

```tsx
{isMaxPlan ? (
  <p>{t("studio_chat_limitModal_maxPlanBody")}</p>
) : (
  <a href="/pricing">{t("studio_chat_limitModal_upgrade")}</a>
)}
```

### 5. Add new translation keys

Add to `frontend/src/translations/en.json`:
```json
{
  "studio_chat_usageWarning_contactSupport": "Contact support",
  "studio_chat_limit_maxPlan": "Monthly limit reached",
  "studio_chat_limitModal_maxPlanBody": "You have reached your monthly generation limit. Contact support to discuss additional capacity."
}
```

## Verification

After the fix:
1. Log in as an enterprise user.
2. Exhaust or mock-exhaust the usage limit.
3. Confirm the banner/modal shows "Monthly limit reached" or "Contact support" — not "Upgrade plan".
4. Log in as a basic/pro user at the limit and confirm the upgrade CTA still appears correctly.
