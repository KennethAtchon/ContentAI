# Frontend Public Routes Migration

All files in `frontend/src/routes/(public)/` and `frontend/src/routes/index.tsx`.

---

## `src/routes/index.tsx` — Homepage

**Current state**: Full CalcPro marketing page. Shows mortgage/loan/investment/retirement calculator feature cards, social proof stats ("10,000 Active Users", "Bank-Level Security"), and a "Why professionals choose CalcPro" section.

**What must change**: Complete rewrite of every section's content. Layout structure (PageLayout, HeroSection, Section, Card) can stay. Only the text and icons change.

### Section-by-section plan:

#### Hero Section
- **Current**: `t("common_financial_calculators")` + `t("common_built_for_professionals")`
- **Replace with**: ReelStudio headline — e.g. "Viral Reels. Decoded." + sub-headline about turning top-performing reels into your content strategy
- Badge: "AI-Powered Content Intelligence" instead of whatever is there now
- CTA buttons: "Start Analyzing Reels" → `/studio/discover` and "View Plans" → `/pricing`

#### Social Proof Bar
- **Current**: 10K Users, 99.9% Uptime, Bank Security, 24/7 Support
- **Replace with**: Stats relevant to ReelStudio — e.g. "50K+ Reels Analyzed", "2.3x Avg Engagement Lift", "500+ Creators", "AI-Powered Hooks"

#### Features Grid (4 cards)
- **Current**: Mortgage Calculator, Investment Calculator, Loan Calculator, Retirement Planner
- **Replace with**: 4 ReelStudio feature cards:
  1. **Viral Reel Discovery** — Scan any niche and surface top-performing reels by engagement
  2. **AI Hook Analysis** — Decode exactly why a reel went viral: hook pattern, emotional trigger, format
  3. **Content Generation** — One-click remix: generate hooks, captions, and scripts from any reel
  4. **Content Queue** — Schedule and organize your generated content for publishing

#### "Why Professionals Choose" Section
- **Current**: `t("common_why_professionals_choose_calcpro")` — explicit CalcPro mention
- **Replace with**: "Why Creators Choose ReelStudio" with 3 benefit cards:
  1. **Data-Driven Strategy** — Stop guessing. Know exactly what hooks, formats, and triggers drive views
  2. **10x Faster Content** — Go from scroll to publish-ready script in seconds, not hours
  3. **Niche Intelligence** — Deep-dive into any niche: finance, fitness, business, lifestyle, and more

#### CTA Section
- **Current**: Generic "Ready to Start" with "View Pricing Plans" and "Contact Sales"
- **Replace with**: "Start growing with viral insights" — keep the two CTA buttons but update text

### Translation keys used in this file (must all be updated in en.json):
- `home_hero_badge`
- `home_hero_description`
- `common_financial_calculators` → rename or replace
- `common_built_for_professionals` → rename or replace
- `common_why_professionals_choose_calcpro` → rename or replace
- `home_features_mortgage_title`, `home_features_mortgage_description`
- `home_features_investment_title`, `home_features_investment_description`
- `home_features_loan_title`, `home_features_loan_description`
- `home_features_retirement_title`, `home_features_retirement_description`
- `home_cta_description`
- `features_ready_to_start`

### Imports to update:
- Remove: `Calculator` icon from lucide-react
- Add: `TrendingUp`, `Sparkles`, `Zap`, `Play` icons (or similar studio-relevant icons)

---

## `src/routes/(public)/pricing.tsx`

**Current state**: References `PricingInteractive` component and uses calculator-specific FAQ content in translations. The pricing structure itself (basic/pro/enterprise tiers with Stripe) stays the same — only the feature descriptions per tier change.

**What must change**:
- Title: update hero text to reference ReelStudio, not "CalcPro Plans"
- Tier feature lists: replace "Mortgage Calculator", "Loan Calculator", "Investment Calculator", "Retirement Planner", "PDF Export", "Historical Data" with ReelStudio features per tier:
  - **Free/Basic**: Studio access, 10 reel scans/day, AI analysis (5/day), content generation (3/day)
  - **Pro**: Unlimited scans, unlimited AI analysis, content generation (50/day), queue (25 items), analytics
  - **Enterprise**: Everything unlimited, team workspace, API access, priority support
- Pricing FAQ section: remove calculator questions, add ReelStudio-relevant FAQs

### Files involved:
- `src/routes/(public)/pricing.tsx` — wrapper, may need hero title update
- `src/routes/(public)/pricing/-pricing-interactive.tsx` — read this file; likely contains the tier feature lists

---

## `src/routes/(public)/about.tsx`

**Current state**: Unknown content — likely references CalcPro company history and calculator expertise.

**What must change**: Full rewrite of company description. Keep the page structure (HeroSection, cards, Section components) but replace all text content:
- Mission: "We believe creators deserve data-driven tools, not gut-feel guesses"
- Story: Built to solve the problem of not knowing why some reels go viral
- Team/values sections if present: keep structure, replace text
- Any "calculator expertise" sections → replace with "AI content intelligence" narrative

### Translation keys likely used (check file):
- `about_calculator_expertise` → replace
- `about_calculator_expertise_description_1/2/3` → replace
- `about_financial_experts` → replace
- `about_financial_experts_description` → replace
- `about_join_thousands` → check and update

---

## `src/routes/(public)/features.tsx`

**Current state**: Lists product features — likely calculator-focused (accuracy, export, security, API).

**What must change**: Replace feature descriptions with ReelStudio features:
- Viral Reel Discovery Engine
- AI-Powered Hook Analysis (hookPattern, hookCategory, emotionalTrigger, formatPattern)
- Content Generation (hook variants, captions, scripts)
- Content Queue & Scheduling
- Instagram Publishing Integration (roadmap)
- Niche Intelligence (cross-niche trend analysis)

Keep the existing page layout/component structure. Only content changes.

---

## `src/routes/(public)/faq.tsx`

**Current state**: FAQs are returned from `getFAQCategories()` which was already stubbed to return an empty array (from previous migration attempt). The page renders an empty list.

**What must change**:
- Replace the stub `getFAQCategories` function with actual ReelStudio FAQ data
- FAQ categories and questions:
  - **Getting Started**: What is ReelStudio? How do I scan a niche? How does AI analysis work?
  - **Content Generation**: How are hooks generated? What output formats? How many per day?
  - **Billing & Plans**: What's included in free tier? How does pro differ? Cancel anytime?
  - **Technical**: What niches are supported? How current is the data? Instagram connection?

---

## `src/routes/(public)/contact.tsx`

**Current state**: The contact form client component was already stubbed to `null` from a previous migration attempt. The page renders with no contact form.

**What must change**:
- Restore a working contact form (or build a simple one inline using react-hook-form + zod)
- Update support email from `support@calcpro.com` to `support@reelstudio.ai`
- Update contact info cards: remove "Phone" if not applicable, keep Email and Support sections
- The form should POST to `/api/public/contact` (existing endpoint)

---

## `src/routes/(public)/support.tsx`

**Current state**: Support center page — likely has calculator-specific help articles and categories.

**What must change**:
- Replace calculator help categories with ReelStudio categories:
  - Getting started with reel scanning
  - Understanding AI analysis results
  - Content generation tips
  - Managing your queue
  - Billing and subscriptions
- Keep page layout structure

### Translation keys to check:
- `support_calculators_title` → replace with studio equivalent
- `support_calculators_desc` → replace

---

## `src/routes/(public)/api-documentation.tsx`

**Current state**: API docs page — references calculator API endpoints (`/api/calculator/calculate`, `/api/calculator/history`, `/api/calculator/export`, `/api/calculator/usage`, `/api/calculator/types`).

**What must change**: Replace calculator API docs with ReelStudio API:
- `GET /api/reels` — List reels by niche
- `GET /api/reels/:id` — Get reel with analysis
- `POST /api/reels/:id/analyze` — Run AI analysis
- `POST /api/generation` — Generate content from reel
- `GET /api/generation` — List generation history
- `GET /api/queue` — List content queue
- `PATCH /api/queue/:id` — Update queue item status

### Translation keys to check:
- `api_calculators_title` → replace with `api_reels_title`
- `api_endpoint_types` → update
- `api_endpoint_calculate` → replace with `api_endpoint_analyze`
- `api_endpoint_history` → keep concept, update description
- `api_endpoint_export` → replace with `api_endpoint_generate`
- `api_endpoint_usage` → keep

---

## `src/routes/(public)/terms.tsx`

**Current state**: Terms of Service — likely generic with CalcPro name in company references.

**What must change**: Search for "CalcPro" mentions and replace with "ReelStudio". Update service description references from "financial calculator" to "AI content intelligence platform". No structural changes needed.

---

## `src/routes/(public)/privacy.tsx`

**Current state**: Privacy Policy — likely has CalcPro name and describes data collected for calculators.

**What must change**: Replace "CalcPro" with "ReelStudio". Update data collection description from calculator inputs to reel scan data and content generation. Keep the legal boilerplate structure.

---

## `src/routes/(public)/cookies.tsx`

**Current state**: Cookie Policy — likely generic with CalcPro branding.

**What must change**: Replace CalcPro → ReelStudio in any brand mentions. Content is mostly standard boilerplate and likely fine otherwise.

---

## `src/routes/(public)/accessibility.tsx`

**Current state**: Accessibility Statement — likely CalcPro branded.

**What must change**: Replace CalcPro → ReelStudio. No structural changes.
