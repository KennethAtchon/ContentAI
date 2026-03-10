# Page-by-Page Transformation Plan

This document specifies **exactly** what changes are needed for every route file in the codebase, organized by route group, with priority order. Each entry specifies the current state, target state, and the specific class/component changes needed.

---

## Priority Order

1. **Root layout** (`__root.tsx`) — affects the 404 page and overall wrapper
2. **Home page** (`/`) — the landing page is the first impression
3. **Auth pages** (`/(auth)/*`) — sign-in and sign-up
4. **Public pages** (`/(public)/*`) — about, pricing, features, faq, contact, etc.
5. **Customer pages** (`/(customer)/*`) — account, checkout
6. **Admin pages** (`/admin/*`) — dashboard, settings, developer tools
7. **Studio pages** (`/studio/*`) — already correct, verify only

---

## 1. Root Layout

### `frontend/src/routes/__root.tsx`

**Changes needed:**

| Line | Current | Target |
|---|---|---|
| Loading fallback | `<div className="p-6 text-center">` | `<div className="p-6 text-center bg-studio-bg text-studio-fg font-studio min-h-screen flex items-center justify-center">` |
| 404 page | Uses `PageLayout variant="public"` | Use `StudioShell variant="public"` |
| 404 text | `text-4xl font-bold` / `text-muted-foreground` | `text-[32px] font-bold text-slate-100` / `text-[14px] text-slate-200/40` |

---

## 2. Home Page (`/`)

### `frontend/src/routes/index.tsx`

This is the **most complex migration** — a full marketing landing page.

**Current structure**: `PageLayout` → Hero → Social Proof → Features Grid → Why Choose → CTA

**Target structure**: `StudioShell variant="public"` → `StudioHero` → Dark Social Proof → Dark Feature Cards → Dark Benefits → Dark CTA

### Specific Changes

#### Hero Section (lines 41-85)
```diff
- <section className="relative overflow-hidden border-b">
-   <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-blue-500/5" />
-   <div className="container relative py-24 md:py-32 lg:py-40">
+ <section className="relative overflow-hidden border-b border-white/[0.05]">
+   <div className="absolute inset-0 bg-gradient-to-br from-studio-accent/[0.04] via-studio-purple/[0.02] to-transparent" />
+   <div className="max-w-[900px] mx-auto relative py-16 md:py-20 px-6">
```

- Badge: `border bg-background/80` → `border border-white/[0.08] bg-white/[0.03]`
- Badge icon: `text-primary` → `text-studio-accent`
- Badge text: `text-muted-foreground` → `text-slate-200/50`
- H1: `text-5xl font-bold` → `text-[36px] md:text-[44px] font-bold text-slate-100 tracking-tight`
- Gradient span: `from-primary via-purple-600 to-blue-600` → `from-studio-accent to-studio-purple`
- Description: `text-xl text-muted-foreground` → `text-[15px] text-slate-200/45 leading-[1.6]`
- Primary Button: `saas-button` + standard shadcn → Studio gradient button pattern
- Outline Button: `border-2 saas-button` → Ghost button pattern

#### Social Proof (lines 88-104)
```diff
- <section className="border-b bg-muted/30 py-8">
+ <section className="border-b border-white/[0.05] bg-white/[0.015] py-6">
```
- Value text: `text-2xl font-bold text-foreground` → `text-[20px] font-bold text-studio-accent font-studio-mono`
- Label text: `text-sm text-muted-foreground` → `text-[10px] text-slate-200/35 uppercase tracking-[1px]`

#### Features Grid (lines 107-170)
- Section heading: `text-3xl font-bold` → `text-[22px] font-bold text-slate-100`
- Section description: `text-lg text-muted-foreground` → `text-[13px] text-slate-200/40`
- Cards: Replace `<Card className="group border-2">` with dark card pattern `bg-white/[0.03] border border-white/[0.06] rounded-[14px]`
- Icon container: `bg-primary/10 text-primary` → `bg-studio-accent/15 text-studio-accent`
- Card title: `text-xl font-semibold` → `text-[14px] font-bold text-studio-fg`
- Card description: `text-sm text-muted-foreground` → `text-[12px] text-slate-200/45`

#### Why Choose Section (lines 173-218)
```diff
- <section className="border-y bg-gradient-to-b from-muted/50 to-background py-20 md:py-28">
+ <section className="border-y border-white/[0.05] bg-gradient-to-b from-white/[0.02] to-transparent py-12 md:py-16">
```
- Icon containers: `bg-primary/10` / `bg-purple-500/10` / `bg-blue-500/10` → all `bg-studio-accent/15`
- Icon colors: `text-primary` / `text-purple-600` / `text-blue-600` → `text-studio-accent`
- Text: `text-muted-foreground` → `text-slate-200/45`

#### CTA Section (lines 221-248)
- Card: `border-2 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5` → `bg-white/[0.03] border border-white/[0.06] rounded-[14px]`
- Heading/description: same typography updates as above

---

## 3. Auth Pages

### `frontend/src/routes/(auth)/sign-in.tsx`

**Target look**: Full-screen dark centered card with studio styling.

#### Wrapper
```diff
- <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/20">
+ <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
+   <StudioTopBar variant="auth" />
```

#### Sign-in Card
```diff
- <Card className="border-2 shadow-lg">
+ <div className="bg-white/[0.03] border border-white/[0.06] rounded-[14px] overflow-hidden">
```

- `CardHeader` → dark styled div
- Logo icon: `bg-primary/10` → `bg-studio-accent/15`, `text-primary` → `text-studio-accent`
- Title: `text-3xl font-bold` → `text-[22px] font-bold text-slate-100`
- Description: `text-base` → `text-[13px] text-slate-200/40`
- Labels: `text-sm font-medium` → `text-[11px] font-semibold text-slate-200/50`
- Inputs: Apply dark input pattern (see design system doc)
- Submit button: Standard shadcn → Studio gradient button
- Divider: `border-t` + `bg-background` → `border-white/[0.06]` + `bg-studio-bg`
- Google button: `border-2` outline → `bg-white/[0.05] border border-white/[0.08]`
- Links: `text-primary` → `text-studio-accent`
- Error alert: `variant="destructive"` → `bg-red-400/[0.08] border border-red-400/20 text-red-400`
- Trust indicators: `text-primary` → `text-studio-accent`, `text-muted-foreground` → `text-slate-200/35`

### `frontend/src/routes/(auth)/sign-up.tsx`

Same pattern as sign-in. Apply identical changes.

---

## 4. Public Pages

All public pages follow the same pattern. Apply these **universal changes** then handle page-specific items:

### Universal Public Page Changes

Replace:
```tsx
<PageLayout variant="public">
  <HeroSection ... />
  <Section ... >
```

With:
```tsx
<StudioShell variant="public" showFooter>
  <StudioHero ... />
  <StudioSection ... >
```

### `/(public)/about.tsx`
- Mission card: Dark card pattern
- Values grid: `StudioFeatureCard`s
- Team highlights: `StudioFeatureCard`s  
- Content Intelligence card: Dark card
- CTA: Dark gradient CTA card

### `/(public)/features.tsx`
- Studio features grid (2-col): Dark cards with tier badges
- Platform features grid (4-col): Dark cards
- Use cases grid: `StudioFeatureCard`s
- Badges: `variant="outline"` → `bg-white/[0.04] border-white/[0.08] text-[9px] text-slate-200/50`
- CheckCircle2 icons: `text-green-600` → `text-green-400`

### `/(public)/pricing.tsx`
- Hero: `StudioHero`
- Pricing cards (in `-pricing-interactive.tsx`): Dark card pattern with studio accent for featured tier
- FAQ accordion: Dark card, dark borders
- CTA: Dark CTA card

### `/(public)/faq.tsx`
- Accordion: Dark card background, `border-white/[0.06]` borders
- Category tabs: Studio pill pattern

### `/(public)/contact.tsx`
- Form card: Dark card pattern
- Form inputs: Dark input pattern
- Submit button: Studio gradient button

### `/(public)/support.tsx`
- Support category cards: Dark feature card pattern
- Help options: Dark cards

### `/(public)/about.tsx`, `privacy.tsx`, `terms.tsx`, `cookies.tsx`, `accessibility.tsx`, `api-documentation.tsx`
- These are content-heavy legal/info pages
- Hero section: `StudioHero`
- Content sections: Dark backgrounds
- Text: `text-slate-200/55` for body copy
- Headings in content: `text-[16px] font-bold text-slate-100`
- Body paragraphs: `text-[13px] text-slate-200/55 leading-[1.7]`

---

## 5. Customer Pages

### `/(customer)/account.tsx`
- Replace `PageLayout variant="customer"` with `StudioShell variant="customer"`
- H1: `text-4xl font-bold` → `text-[22px] font-bold text-slate-100`
- Subtitle: `text-lg text-muted-foreground` → `text-[13px] text-slate-200/40`

### `/(customer)/account/-account-interactive.tsx`
- `TabsList`: `bg-muted/50` → `bg-white/[0.03] border border-white/[0.06] rounded-[10px]`
- `TabsTrigger` active: `bg-background shadow-sm` → `bg-studio-accent/[0.08] text-studio-accent`
- All sub-cards: Dark card pattern
- Stat boxes: `bg-muted/30` → `bg-white/[0.04] border border-white/[0.06] rounded-[10px]`
- Stat values: `text-3xl font-bold text-foreground` → `text-[20px] font-bold text-studio-accent font-studio-mono`
- "Open Studio" button: Studio gradient button

### `/(customer)/checkout/-checkout-interactive.tsx`
- Form card: Dark card pattern
- Inputs: Dark input pattern
- Price displays: Studio accent color

---

## 6. Admin Pages

### `admin/_layout.tsx`
- Replace `DashboardLayout` wrapper to use `StudioShell variant="admin"`
- Or restyle `DashboardLayout` to use studio tokens

### `admin/_layout/settings.tsx`
- H1: `text-2xl font-bold` → `text-[20px] font-bold text-slate-100`
- Description: `text-muted-foreground` → `text-slate-200/40`
- Profile card: Dark card pattern
- Settings form card: Dark card pattern
- Label "Name", "Email": `text-sm font-medium text-muted-foreground` → `text-[11px] font-semibold text-slate-200/40`
- Values: `text-base font-semibold` → `text-[13px] font-semibold text-studio-fg`
- Inputs: Dark input pattern
- Submit button: Studio gradient
- Success/error alerts: Studio-styled

### Other admin pages (`dashboard.tsx`, `developer.tsx`, `customers.tsx`, `orders.tsx`, `subscriptions.tsx`, `contactmessages.tsx`)
- Apply the same dark theme patterns
- Data tables: Dark `bg-white/[0.03]` rows, `border-white/[0.06]` borders
- Badges/status indicators: Use studio status color scheme

---

## 7. Studio Pages (verification only)

These pages are already correct. Verify they still work after shared component changes:

- ✅ `/studio/discover.tsx`
- ✅ `/studio/generate.tsx`
- ✅ `/studio/queue.tsx`
- ✅ `/studio/index.tsx` (redirect)
- ✅ `StudioTopBar.tsx`
- ✅ `AnalysisPanel.tsx`
- ✅ `PhonePreview.tsx`
- ✅ `ReelList.tsx`
