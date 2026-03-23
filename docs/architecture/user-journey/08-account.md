# Account Management Journey

**Route:** `/account`
**Auth:** Required (`authType="user"`)
**Entry:** User avatar → "Account" in header dropdown, or direct navigation

---

## Overview

The Account page is the user's self-service hub.

**Layout:** Left sidebar with navigation links + usage bars → right content area with the selected section.

---

## Sidebar (Always Visible)

- User name and email
- Navigation links: Overview, Subscription, Usage, Orders, Profile, Preferences
- Mini usage bars for:
  - Reels Analyzed (turns red at ≥80% of plan limit)
  - Content Generated (turns red at ≥80%)
  - Queue Items (turns red at ≥80%)
- "Open Studio" quick-link button

---

## Section: Overview

**What the user sees:**
- Studio stats: Content Generated, Queue Items, Reels Analyzed (counts from `GET /api/customer/usage`)
- Quick action: "Open Studio" → `/studio/discover`

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Navigate to /account (Overview tab)
    FE->>BE: GET /api/customer/usage
    BE->>DB: SELECT usage stats for current billing period
    DB-->>BE: { reelsAnalyzed, contentGenerated, queueItems, limits }
    BE-->>FE: Usage data
    FE->>FE: Render stats + mini usage bars in sidebar
```

---

## Section: Subscription

**What the user sees:**
- Current plan: tier name, billing cycle (monthly/annual), status (active/trialing/canceled), next billing date
- "Manage Subscription" button → opens Stripe Customer Portal
- If no active subscription: "Choose a Plan" CTA → `/pricing`
- Usage bar: monthly usage vs plan limit

**What the user can do:**
- Manage billing via Stripe portal (change payment method, view invoices, cancel, change plan)
- Navigate to pricing to subscribe

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant FB as Firestore (Firebase Stripe Extension)

    U->>FE: Click "Subscription" in sidebar
    FE->>FB: Listen to customers/{uid}/subscriptions (real-time)
    FB-->>FE: Subscription data (tier, status, billingCycle, currentPeriodEnd)
    FE->>FE: Render subscription card

    alt Has active subscription
        U->>FE: Click "Manage Subscription"
        FE->>BE: POST /api/subscriptions/portal-link
        BE->>FB: Call createPortalLink() extension
        FB-->>BE: { url: stripe_portal_url }
        BE-->>FE: { url }
        FE->>FE: Redirect to Stripe portal
    else No subscription
        U->>FE: Click "Choose a Plan"
        FE->>FE: Navigate to /pricing
    end
```

---

## Section: Usage

**What the user sees:**
- Detailed usage statistics for the current billing period
- Charts/graphs of usage over time
- Usage vs. plan limit for each resource type
- Export button to download usage data as CSV

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Click "Usage" in sidebar
    FE->>BE: GET /api/customer/usage?detailed=true
    BE-->>FE: { dailyBreakdown: [...], totals: {...}, limits: {...} }
    FE->>FE: Render UsageDashboard with charts

    U->>FE: Click "Export"
    FE->>BE: GET /api/customer/usage/export
    BE-->>FE: CSV file download
```

---

## Section: Orders

**What the user sees:**
- List of past one-time purchases
- Each order: date, item name, amount, status (pending/completed/refunded)
- Expandable detail view per order

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Orders" in sidebar
    FE->>BE: GET /api/customer/orders
    BE->>DB: SELECT orders WHERE user_id=:uid ORDER BY created_at DESC
    DB-->>BE: Orders list
    BE-->>FE: [{ id, amount, status, items, createdAt }]
    FE->>FE: Render orders list

    U->>FE: Click an order to expand
    FE->>FE: Open OrderDetailModal with line items
```

---

## Section: Profile

**What the user sees:**
- Full Name field (editable)
- Email (read-only for OAuth users; note explains why)
- Phone Number field
- Address fields
- "Save Changes" button

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Profile" in sidebar
    FE->>FE: Render ProfileEditor with current values (from user context)

    U->>FE: Edit name, phone, address → Click "Save Changes"
    FE->>BE: PUT /api/customer/profile { name, phone, address }
    BE->>DB: UPDATE users SET name=..., phone=..., address=... WHERE uid=:uid
    DB-->>BE: Updated user
    BE-->>FE: { success: true }
    FE->>FE: Show "Profile updated" toast
    FE->>FE: Update user context with new values
```

---

## Section: Preferences

**What the user sees:**
- AI provider preference (dropdown)
- Video provider preference (dropdown)
- Preferred TTS voice ID (dropdown, same voices as in audio workspace)
- Preferred TTS speed (dropdown)
- Preferred aspect ratio (dropdown: 9:16, 1:1, 16:9)
- "Save Preferences" button

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Preferences" in sidebar
    FE->>BE: GET /api/customer/settings
    BE->>DB: SELECT user_settings WHERE user_id=:uid
    DB-->>BE: { aiProvider, videoProvider, voiceId, ttsSpeed, aspectRatio }
    BE-->>FE: Settings
    FE->>FE: Render preference dropdowns with current values

    U->>FE: Change settings → Click "Save Preferences"
    FE->>BE: PUT /api/customer/settings { aiProvider, videoProvider, voiceId, ttsSpeed, aspectRatio }
    BE->>DB: UPDATE user_settings SET ... WHERE user_id=:uid
    BE-->>FE: { success: true }
    FE->>FE: Show "Preferences saved" toast
```

---

## Sidebar Usage Bar Logic

The mini usage bars in the sidebar are always visible and update reactively:

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend

    Note over FE: On account page load
    FE->>BE: GET /api/customer/usage
    BE-->>FE: { reelsAnalyzed: 45, reelsLimit: 50, contentGenerated: 8, contentLimit: 20, ... }
    FE->>FE: Render mini bars (red if usage/limit >= 0.8)
    Note over FE: Bars update whenever usage data is invalidated (e.g., after generating content)
```
