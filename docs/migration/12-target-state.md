# ReelStudio — Target State

> The complete, expected final state of the product. Every route, every user flow, every system interaction.
> Use this as the source of truth when implementing.

---

## What This Product Is

**ReelStudio** is an AI-powered content intelligence platform for creators and marketers. Users discover viral reels in any niche, get AI analysis explaining exactly why they perform, then generate hooks, captions, and scripts inspired by that data — and schedule them for publishing.

The underlying SaaS infrastructure (auth, subscriptions, billing, admin) is completely product-agnostic and stays intact from the template.

---

## Subscription Tiers

| Tier | Price | Core Limits |
|------|-------|-------------|
| **Free** (no sub) | $0 | 5 reel scans/day · 2 AI analyses/day · 1 generation/day · queue 3 items |
| **Basic** | $19/mo | 25 scans/day · 10 analyses/day · 10 generations/day · queue 10 items |
| **Pro** | $49/mo | Unlimited scans · Unlimited analysis · 50 generations/day · queue 50 · Instagram publishing |
| **Enterprise** | $149/mo | Everything unlimited · Team workspace · API access · Priority support |

Feature gates enforced server-side. Frontend shows upgrade prompts via `feature-gate.tsx` when limit is hit.

---

## Route Map

### Public Routes (no auth required)

```
/                           Homepage — hero, features, social proof, pricing CTA
/pricing                    Pricing page — tier cards, feature comparison, FAQ
/features                   Product feature breakdown — the 4 core pillars
/about                      Company story, mission, team
/faq                        FAQ — Getting Started, Generation, Billing, Technical
/contact                    Contact form + email + support links
/support                    Help center — categorized articles
/api-documentation          API reference for developers
/terms                      Terms of Service
/privacy                    Privacy Policy
/cookies                    Cookie Policy
/accessibility              Accessibility Statement
```

### Auth Routes (redirect to /studio/discover if already logged in)

```
/sign-in                    Email/password + Google OAuth sign-in
/sign-up                    Account creation → redirects to /studio/discover on success
```

### Studio Routes (requires auth: `authType="user"`)

```
/studio                     → redirects to /studio/discover
/studio/discover            Main 3-panel studio: reel list + phone preview + analysis
/studio/generate            Full-screen generation workspace with reel picker + history
/studio/queue               Content queue — filter by status, schedule, delete
```

### Customer Routes (requires auth: `authType="user"`)

```
/account                    Account dashboard (tabs: Overview, Subscription, Usage, Orders, Profile)
/checkout                   Stripe subscription checkout
/payment/success            Post-payment confirmation + "Open Studio" CTA
/payment/cancel             Payment cancelled — back to pricing
```

### Admin Routes (requires auth: `authType="admin"`)

```
/admin                      → redirects to /admin/dashboard
/admin/dashboard            KPIs: users, MRR, reels analyzed, content generated, churn
/admin/customers            User list — search, filter by tier, view per-user usage
/admin/orders               Order history — all purchases, refunds
/admin/subscriptions        Subscription analytics — tier breakdown, MRR trend, churn
/admin/settings             App config — feature flags, email templates, rate limits
/admin/developer            Dev tools — API key management, webhook logs, test events
/admin/contactmessages      Contact form inbox — mark read, reply, delete
```

---

## User Flows

### Flow 1: New Visitor → Paying Creator

```
1. Lands on /
   → Sees: "Viral Reels. Decoded." hero
   → Sees: 4 feature cards (Discovery, Analysis, Generation, Queue)
   → Clicks: "Start Analyzing Reels" CTA

2. /sign-up
   → Fills: name, email, password
   → Firebase creates account
   → Redirect: /studio/discover

3. /studio/discover (first time)
   → Sees: 3-panel studio, niche defaulted to "personal finance"
   → Left panel shows 6 seeded mock reels
   → Selects a reel
   → Center shows phone preview with floating stat cards
   → Right panel shows "Analysis" tab with reel metrics + "Run Analysis" button
   → Clicks "Run Analysis"
   → AI analyzes the reel (Claude haiku) — hook pattern, emotional trigger, format, CTA type
   → Analysis tags appear: Warning · Curiosity · ListFormat · SoftCTA
   → Clicks "Generate" tab
   → Types prompt: "rewrite this hook for a 20-something audience"
   → Clicks "✦ Generate Content"
   → AI generates hook + caption + script notes (Claude sonnet)
   → Result appears with "Copy Hook", "Copy Caption", "+ Add to Queue" buttons
   → Hits free tier generation limit on 2nd generation
   → Sees upgrade prompt: "Upgrade to Basic to generate 10×/day"

4. /pricing (from upgrade prompt)
   → Reviews tier cards
   → Clicks "Get Basic — $19/mo"

5. /checkout
   → Stripe checkout form
   → Enters card details
   → Confirms payment

6. /payment/success
   → Sees: "You're on Basic! Your studio is ready."
   → Clicks: "Open Studio" → back to /studio/discover

7. /studio/discover (now Basic subscriber)
   → 10 generations/day limit
   → Uses Discover → Analyze → Generate → Queue loop
```

---

### Flow 2: Returning User — Daily Workflow

```
1. Visits /
   → Already signed in
   → Navbar shows "Discover" + "Account" links
   → Clicks "Discover"

2. /studio/discover
   → Changes niche to "fitness" in search bar
   → Clicks "Scan" — fetches reels for fitness niche
   → Browses reel list
   → Finds a high-engagement reel (2.1M views, 8.3% engagement)
   → Reviews phone preview
   → Analysis already exists from previous session → tags shown immediately
   → Switches to "Generate" tab
   → Generates 3 hook variants
   → Queues the best one

3. /studio/queue
   → Reviews queued items
   → Filters to "scheduled"
   → Sets publish date on a queued item
   → For Pro users: connects Instagram → publishes directly
   → For Basic users: copies content manually

4. /account (occasionally)
   → Checks usage dashboard: "7/10 generations used today"
   → Reviews order history
   → Updates profile
```

---

### Flow 3: Admin — Platform Management

```
1. Visits /sign-in
   → Signs in with admin Firebase account

2. /admin (redirects to /admin/dashboard)
   → KPI cards:
     - Total Users: 1,247 (+12 this week)
     - MRR: $8,430 (+$210 this month)
     - Reels Analyzed: 34,891 total
     - Content Generated: 12,334 total
     - Active Subscribers: 89 (Basic: 52, Pro: 31, Enterprise: 6)

3. /admin/customers
   → Searches for a specific user
   → Views: email, tier, join date, reels analyzed, content generated, last active
   → Can: edit tier (manual override), disable account, reset password

4. /admin/subscriptions
   → MRR trend chart
   → Tier distribution: Basic 58%, Pro 35%, Enterprise 7%
   → Churn rate: 3.2% monthly

5. /admin/contactmessages
   → New message: "I hit my generation limit, can I get more?"
   → Marks as read, replies via email

6. /admin/settings
   → Adjusts free tier rate limits
   → Updates ANTHROPIC_API_KEY
   → Toggles feature flags (e.g. Instagram publishing — off by default)

7. /admin/developer
   → Views webhook delivery logs (Stripe events)
   → Tests API endpoints
   → Inspects recent errors
```

---

## Page-by-Page Expected State

### `/` — Homepage

**Sections** (top to bottom):
1. **Nav**: Logo + Pricing + FAQ + Contact | [Sign In] [Get Started]
   _When logged in_: Logo + Pricing + FAQ | [Discover] [Account]

2. **Hero**: Large headline split across two lines, gradient on second line
   Badge: "AI-Powered Content Intelligence"
   H1: "Viral Reels."
   H1 gradient: "Decoded."
   Sub: "Discover top-performing reels in any niche, understand exactly why they go viral, and generate content that performs."
   CTAs: "Start Analyzing Reels →" (primary) + "View Pricing" (ghost)

3. **Social proof bar**: 4 inline stats
   50K+ Reels Analyzed · 2.3× Avg Engagement Lift · 500+ Active Creators · AI-Powered Hooks

4. **Features grid** (2×2 on desktop, stacked mobile):
   - 🔍 Viral Reel Discovery
   - 🧠 AI Hook Analysis
   - ✦ Content Generation
   - 📅 Content Queue

5. **Why ReelStudio** (3 benefit cards):
   Data-Driven Strategy · 10× Faster Content · Niche Intelligence

6. **CTA section**: Full-width gradient card
   "Start growing with viral insights" + "View Plans" + "Contact Sales"

7. **Footer**: Logo + tagline | Product links | Resources | Contact info | Legal

---

### `/pricing` — Pricing

**Sections**:
1. Hero: "Simple, transparent pricing" badge + headline
2. **Billing toggle**: Monthly / Annual (save 20%)
3. **Tier cards** (3 columns):

| | Free | Basic $19 | Pro $49 | Enterprise $149 |
|-|------|-----------|---------|-----------------|
| Reel scans/day | 5 | 25 | Unlimited | Unlimited |
| AI analyses/day | 2 | 10 | Unlimited | Unlimited |
| Content gen/day | 1 | 10 | 50 | Unlimited |
| Queue size | 3 | 10 | 50 | Unlimited |
| Instagram publishing | ✗ | ✗ | ✓ | ✓ |
| Advanced analytics | ✗ | ✗ | ✓ | ✓ |
| API access | ✗ | ✗ | ✗ | ✓ |
| Team workspace | ✗ | ✗ | ✗ | ✓ |
| Support | Community | Email | Priority | Dedicated |

4. **Pricing FAQ**: 6 questions (What's included in free? How does billing work? Cancel anytime? Enterprise custom pricing? etc.)
5. **CTA**: "Still unsure? Talk to us →"

---

### `/studio/discover` — Main Studio

```
┌─────────────────────────────────────────────────────────┐
│  ✦ ReelStudio  [Discover] [✦ Generate] [Queue]   [fitness] [Scan]  │
├────────────┬────────────────────────────┬───────────────┤
│ SOURCE     │                            │  [Analysis][Generate][History] │
│ REELS  6   │                            │               │
│────────────│    ┌──────────────────┐    │  METRICS      │
│ @finance1  │    │  ┌──────┐ ┌────┐ │   │  ┌────┬────┐  │
│ 2.1M · 8% │    │  │ Eng  │ │ Vws│ │   │  │ 2M │ 45K│  │
│ @wellness2 │    │  │ 8.3% │ │2.1M│ │   │  └────┴────┘  │
│ 900K · 6% │    │  └──────┘ └────┘ │   │               │
│            │    │                  │   │  HOOK         │
│            │    │       🎬          │   │  "One thing   │
│ AI TOOLS   │    │                  │   │  you must..." │
│────────────│    │  ┌──────┐ ┌────┐ │   │               │
│ ✦ Hook     │    │  │ 12d  │ │ ❤ │ │   │  AI ANALYSIS  │
│ ✦ Caption  │    │  │ ago  │ │45K │ │   │  [Warning] [Curiosity] │
│ ✦ Remix    │    │  └──────┘ └────┘ │   │  [ListFormat]          │
│ ✦ VoiceOver│    │                  │   │               │
│ ✦ Scheduler│    │     @finance1    │   │  Remix Idea:  │
│            │    │  "You'll regret  │   │  "Mirror this │
│            │    │   skipping..."   │   │  for fitness" │
│            │    └──────────────────┘   │               │
│            │  [← Prev] [Next →] │✂ ♪ T│               │
│            │  [✦ Generate Remix] ─────┤               │
└────────────┴────────────────────────────┴───────────────┘
```

**Behaviors**:
- First reel auto-selected on load
- Niche search: type + Enter or click "Scan" to reload list
- Selecting a reel fetches full detail + existing analysis
- "Run Analysis" → POST /api/reels/:id/analyze → returns tags, remixSuggestion
- "Generate" tab → textarea + generate button → result shown inline
- Generated content has "Copy Hook", "Copy Caption", "+ Add to Queue"
- Toolbar navigation: ← → move through reel list
- On mobile: single column, tabs to switch between panels

---

### `/studio/generate` — Generation Workspace

Full-screen focused generation:
- Left column: reel picker (same as sidebar in discover)
- Center: large prompt area + output type toggle (Full / Hook / Caption) + generate button + result
- Right column: generation history list (last 20)

---

### `/studio/queue` — Content Queue

- Header: "Content Queue" + count badge
- Filter pills: All · Scheduled · Posted · Failed
- Cards showing: content preview, scheduled date, status badge, Instagram page (if connected), delete button
- Empty state: "Nothing in your queue yet — generate content to get started"
- Pro+: Schedule picker + Instagram page selector on each card

---

### `/account` — Account Dashboard

**Tabs** (left sidebar or top tabs):

1. **Overview** (default tab)
   - Welcome: "Welcome back, [name]"
   - Current tier badge + usage stats:
     ```
     ┌──────────────────┬──────────────────┬──────────────────┐
     │  Reels Analyzed  │ Content Generated │   Queue Items    │
     │      47          │       12          │        3         │
     │  of 25/day limit │  of 10/day limit  │  of 10 limit     │
     └──────────────────┴──────────────────┴──────────────────┘
     ```
   - "Open Studio →" button → /studio/discover
   - Upgrade CTA if on free or basic

2. **Subscription**
   - Current plan card: name, price, renewal date, status
   - "Upgrade Plan" or "Manage Billing" button (Stripe portal)
   - Plan feature comparison (what you have vs what's above)

3. **Usage**
   - Usage chart: 30-day history of analyses + generations
   - Table: feature, used today, daily limit, used this month

4. **Orders**
   - Order history table: date, product, amount, status
   - Click to expand order details

5. **Profile**
   - Edit: name, phone, address, timezone
   - Password reset (Firebase sends email)
   - Delete account (requires confirmation)

---

### `/admin/dashboard` — Admin Overview

**KPI Cards** (row of 4):
- Total Users | MRR | Reels Analyzed (all-time) | Content Generated (all-time)

**Charts** (side by side):
- MRR over time (line chart)
- New signups per day (bar chart)

**Tables**:
- Recent signups (last 10 users)
- Recent orders (last 10 payments)

**Product-specific metrics**:
- Most analyzed niches (pie chart or list)
- AI model usage and cost estimate

---

## Backend API — Complete Route List

```
# Public (no auth)
GET  /api/live                          Health check (liveness)
GET  /api/ready                         Health check (readiness)
POST /api/public/contact                Contact form submission
GET  /api/csrf/token                    CSRF token

# Auth (Firebase token required on all below)
POST /api/auth/register                 Register user in DB after Firebase signup
GET  /api/auth/me                       Get current user

# User
GET  /api/users/profile                 Get profile
PUT  /api/users/profile                 Update profile
DELETE /api/users/account               Delete account

# Subscriptions
GET  /api/subscriptions                 Get current subscription
POST /api/subscriptions/checkout        Create Stripe checkout session
POST /api/subscriptions/portal          Create Stripe billing portal session
POST /api/subscriptions/webhook         Stripe webhook handler (no auth — Stripe sig)

# Reels
GET  /api/reels                         List reels (?niche=&limit=&offset=)
GET  /api/reels/:id                     Get reel + analysis
POST /api/reels/scan                    Trigger niche scan (placeholder / future Instagram)
POST /api/reels/:id/analyze             Run AI analysis on a reel

# Content Generation
POST /api/generation                    Generate content from a reel
GET  /api/generation                    List generation history (?limit=&offset=)
GET  /api/generation/:id                Get single generated content item

# Queue
GET  /api/queue                         List queue items (?status=&limit=)
PATCH /api/queue/:id                    Update queue item (status, scheduledFor)
DELETE /api/queue/:id                   Remove from queue

# Admin (admin role required)
GET  /api/admin/verify                  Verify admin role
GET  /api/admin/users                   List all users
PUT  /api/admin/users/:id               Edit user (tier, role, active)
GET  /api/admin/orders                  List all orders
GET  /api/admin/subscriptions           List all subscriptions + analytics
GET  /api/admin/contact-messages        List contact form submissions
PUT  /api/admin/contact-messages/:id    Mark read
DELETE /api/admin/contact-messages/:id  Delete
GET  /api/analytics/dashboard           KPIs for admin dashboard

# Customer
GET  /api/customer/usage                Usage stats for current user
GET  /api/customer/orders               Order history for current user
```

---

## Data Flow Diagrams

### Reel Discovery Flow

```
User types niche + clicks Scan
  → GET /api/reels?niche=fitness&limit=20
  → Backend queries reels table WHERE niche = 'fitness'
  → Returns: [{id, username, views, likes, engagementRate, thumbnailEmoji, hook, ...}]
  → Frontend displays in left sidebar
  → First reel auto-selected
  → GET /api/reels/:id (includes analysis if it exists)
  → Phone preview renders
  → Analysis panel shows metrics
```

### AI Analysis Flow

```
User clicks "Run Analysis"
  → POST /api/reels/:id/analyze (CSRF + auth)
  → Backend: load reel data from DB
  → Backend: call Claude haiku with reel-analysis.txt prompt
  → Claude returns JSON: {hookPattern, hookCategory, emotionalTrigger,
                          formatPattern, ctaType, captionFramework,
                          curiosityGapStyle, remixSuggestion}
  → Backend: upsert into reel_analyses table
  → Returns: { analysis: {...} }
  → Frontend: invalidate queryKeys.api.reel(id)
  → Analysis tags + remix suggestion appear in panel
```

### Content Generation Flow

```
User types prompt + clicks Generate
  → POST /api/generation (CSRF + auth)
  → Body: { sourceReelId, prompt, outputType: "full" | "hook" | "caption" }
  → Backend: check rate limit (Redis) — block if over tier limit
  → Backend: load reel + analysis from DB
  → Backend: call Claude sonnet with remix-generation.txt prompt
  → Claude returns JSON: { hook, caption, scriptNotes }
  → Backend: insert into generated_content table with status "draft"
  → Returns: { content: { id, generatedHook, generatedCaption, generatedScript, ... } }
  → Frontend: show result inline with copy + queue buttons
  → On "+ Add to Queue": POST /api/generation/:id/queue
    → Inserts into queue_items table with status "queued"
```

---

## Authentication & Authorization Model

```
                    Firebase Auth (identity)
                           │
              ┌────────────┼────────────┐
              │            │            │
         Anonymous      User        Admin
              │            │            │
         Can see:    Can access:   Can access:
         / public    /studio/*     /admin/*
         /pricing    /account      + all user routes
         /sign-in    /checkout
         /sign-up    /payment/*
```

**Token flow**:
1. Firebase issues ID token on sign-in
2. Frontend attaches `Authorization: Bearer <token>` on all authenticated requests
3. Backend middleware (`requireAuth`) validates token with Firebase Admin SDK
4. Backend middleware (`requireAdmin`) additionally checks `role === "admin"` in custom claims OR verifies via `/api/admin/verify`
5. Sessions managed by Firebase (auto-refresh)

**AuthGuard** (`auth-guard.tsx`):
- `authType="user"` → redirects to /sign-in if not authenticated
- `authType="admin"` → redirects to / if not admin
- Shows spinner while auth state is loading
- Used in: all `/studio/*` routes, all `/account` routes, all `/admin/*` layout

---

## Feature Gating Model

```
Free user hits "Generate Content" (4th time today)
  → Backend: Redis check — limit exceeded
  → Returns 429 with { error: "GENERATION_LIMIT_EXCEEDED", tier: "free", limit: 1 }
  → Frontend: catches the 429
  → Shows <UpgradePrompt feature="generation" /> component
  → UpgradePrompt shows: current limit, what Pro unlocks, "Upgrade to Pro" button → /pricing
```

Feature limits enforced at the API layer — frontend shows current usage counts via `/api/customer/usage` (polled on account page, optionally cached).

---

## Key Design Decisions

### Studio pages bypass PageLayout
Studio routes (`/studio/*`) render directly in the dark `studio-bg` shell — they do NOT use `PageLayout` with navbar + footer. This is intentional: the studio is an app, not a website page. Navigation within the studio is handled by `StudioTopBar`.

### Database seeding for development
The `reels` table must be seeded for the studio to show content. Run `bun run src/scripts/seed-mock-reels.ts` from `backend/`. In production, the `POST /api/reels/scan` endpoint will fetch real data from Instagram API.

### AI is optional — graceful degradation
If `ANTHROPIC_API_KEY` is missing from backend env, the `/api/reels/:id/analyze` and `POST /api/generation` endpoints return HTTP 503 with a clear error. The rest of the app (browsing reels, queue management, account, billing) continues to work normally.

### SaaS infrastructure stays untouched
Stripe, Firebase Auth, Resend email, admin dashboard, subscriptions — all of this is product-agnostic and inherited from the template. The ReelStudio migration only adds new routes, new tables, and replaces the CalcPro content. It does not restructure any SaaS plumbing.

---

## What "Done" Looks Like

A checklist to verify the migration is complete:

### Brand
- [ ] No "CalcPro" anywhere in the UI (search: `grep -ri "calcpro" src/`)
- [ ] No "calculator" in user-facing text
- [ ] Logo, app name, email all say ReelStudio

### Flows
- [ ] Visitor lands on homepage → sees ReelStudio content
- [ ] Sign up → lands on `/studio/discover`
- [ ] Studio shows reels in sidebar (needs seeded DB)
- [ ] Selecting a reel shows phone preview + analysis panel
- [ ] "Run Analysis" works (needs `ANTHROPIC_API_KEY`)
- [ ] "Generate" works and adds to queue
- [ ] Queue shows items with filter pills
- [ ] Account → Overview tab (not Calculator)
- [ ] Account → Subscription → upgrade flow works
- [ ] Pricing page shows ReelStudio tier features
- [ ] Sign out → redirects to homepage

### Admin
- [ ] Admin login works
- [ ] Dashboard shows relevant KPIs (including studio metrics)
- [ ] Customer list loads
- [ ] Contact messages show

### Technical
- [ ] `studio.css` deleted ✅ (done)
- [ ] All studio styles use Tailwind + CSS variables ✅ (done)
- [ ] `ais-*` class names gone ✅ (done)
- [ ] Calculator feature deleted from backend
- [ ] DB migration run (`bun db:migrate`)
- [ ] Mock reels seeded
- [ ] No TypeScript errors in studio files ✅ (done)
