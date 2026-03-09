# Implementation Order

Execute in this exact sequence. Each phase must be complete before moving to the next.

---

## Phase 0: Verify Current State (Before Starting)

Before writing a single line of code:

```bash
# 1. Is the frontend running and accessible?
curl http://localhost:3000

# 2. Is the backend running and healthy?
curl http://localhost:3001/api/live

# 3. Is the database connected?
cd backend && bun db:studio  # Opens Drizzle Studio

# 4. Has the studio migration been run?
# Check if the 'reels' table exists in the DB

# 5. Are there any reels in the database?
# SELECT COUNT(*) FROM reels;
```

---

## Phase 1: Backend Fixes (No Frontend Visible Changes)

Do this first because the frontend depends on it.

### Step 1.1 — Run database migration
```bash
cd backend
bun db:migrate
```
Adds the 5 new tables: reels, reel_analyses, generated_content, instagram_pages, queue_items.

### Step 1.2 — Add ANTHROPIC_API_KEY to backend/.env
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Without this, AI analysis and generation will fail with 503 errors. The app still works — it just can't do AI things.

### Step 1.3 — Seed mock reels
```bash
cd backend
bun run src/scripts/seed-mock-reels.ts
```
This populates the `reels` table with 6 mock reels so the studio has content to show.

### Step 1.4 — Update backend `app.constants.ts`
Change: `APP_NAME`, `APP_DESCRIPTION`, `SUPPORT_EMAIL`, `CORE_FEATURE_SLUG`, `CORE_FEATURE_PATH`, `CORE_FEATURE_API_PREFIX`

### Step 1.5 — Delete calculator feature files
```bash
rm -rf backend/src/features/calculator/
rm -rf backend/src/routes/calculator/
```

### Step 1.6 — Remove calculator route mount from `backend/src/index.ts`
Remove the import and `app.route("/api/calculator", ...)` line.

### Step 1.7 — Update backend analytics route
Remove any calculator-specific analytics endpoints. Add ReelStudio metrics if needed for admin dashboard.

### Step 1.8 — Verify backend tests still pass
```bash
cd backend && bun test
```

---

## Phase 2: Studio Routing Fix (Verify Studio Works)

Already done in this session, but verify.

### Step 2.1 — Confirm routing fix is in place
- `studio.tsx` renders `<Outlet />` ✅
- `studio/index.tsx` redirects to `/studio/discover` ✅

### Step 2.2 — Sign in and navigate to `/studio/discover`
- Verify the 3-panel layout renders
- Verify reels appear in the left sidebar (need Step 1.3 seed first)
- Verify "Run Analysis" button works (need Step 1.2 API key first)

### Step 2.3 — Fix any console errors
- Open browser DevTools on `/studio/discover`
- Fix any import errors, missing translation keys, or API failures

---

## Phase 3: Constants & Utils (Foundation for Everything Else)

### Step 3.1 — Update `redirect-util.ts`
Change `REDIRECT_PATHS.DASHBOARD` from `/account?tab=calculator` to `/studio/discover`.

### Step 3.2 — Update `subscription.constants.ts` (frontend)
Replace calculator feature lists with ReelStudio feature lists per tier.

### Step 3.3 — Update `stripe.constants.ts`
Rename any CalcPro variable names. Keep actual Stripe IDs intact.

### Step 3.4 — Remove `calculator-permissions.ts` (frontend)
- First: `grep -r "calculator-permissions" frontend/src/` to find any consumers
- Fix consumers
- Delete the file

---

## Phase 4: Translations

### Step 4.1 — Open `frontend/src/translations/en.json`
Work through the full list in `08-frontend-translations.md`:
1. Delete all calculator-specific keys
2. Update all CalcPro brand mention keys
3. Add all new ReelStudio keys (homepage features, FAQ, account overview, etc.)

This is safe to do all at once — translation keys only break at runtime when a key is missing (shows the key name, not a crash).

---

## Phase 5: Homepage Redesign

The highest-visibility change. Rewrites `src/routes/index.tsx`.

### Step 5.1 — Read the current homepage fully
Understand every section and every translation key used.

### Step 5.2 — Rewrite hero section
New headline + subheadline + badge + CTA buttons (using new translation keys added in Phase 4).

### Step 5.3 — Rewrite social proof bar
New stats (Reels Analyzed, Engagement Lift, Active Creators, AI Hooks).

### Step 5.4 — Rewrite features grid
4 new ReelStudio feature cards.

### Step 5.5 — Rewrite "Why Choose" section
New copy, new icons, new benefit cards.

### Step 5.6 — Verify homepage renders correctly
- Test on desktop and mobile
- Verify all translation keys resolve
- Verify CTA buttons link to correct pages

---

## Phase 6: Account Page Restructure

### Step 6.1 — Read `account/-account-interactive.tsx` fully

### Step 6.2 — Remove Calculator tab, add Overview tab
The Overview tab should show:
- Quick stats (reels analyzed, content generated, queue items)
- "Open Studio" button linking to `/studio/discover`

### Step 6.3 — Delete `calculator-interface.tsx`

### Step 6.4 — Update `usage-dashboard.tsx`
Replace calculator usage labels with ReelStudio usage labels.

---

## Phase 7: Navigation & Layout

### Step 7.1 — Update footer (`footer-custom.tsx`)
- Replace "Calculators" link with "Studio" link → `/studio/discover`
- Update company email
- Update company tagline

### Step 7.2 — Update auth layout (`auth-layout.tsx`)
- Replace marketing panel copy with ReelStudio pitch

### Step 7.3 — Update customer layout if needed
- Check for calculator references

---

## Phase 8: Public Pages Content

Work through each public page, read it fully, then update.

**Order** (highest to lowest impact):
1. `pricing.tsx` + `-pricing-interactive.tsx` — tier feature lists
2. `features.tsx` — feature descriptions
3. `about.tsx` — company story
4. `faq.tsx` — restore FAQ with ReelStudio questions
5. `contact.tsx` — restore contact form
6. `support.tsx` — update categories
7. `api-documentation.tsx` — update API reference
8. `terms.tsx` — find/replace CalcPro
9. `privacy.tsx` — find/replace CalcPro
10. `cookies.tsx` — find/replace CalcPro
11. `accessibility.tsx` — find/replace CalcPro

---

## Phase 9: Admin Pages Audit

### Step 9.1 — Read `dashboard-view.tsx`
Find and fix product-specific KPI card.

### Step 9.2 — Read `help-modal.tsx`
Find and fix any calculator references.

### Step 9.3 — Read `customers-view.tsx`
Check user detail metrics.

### Step 9.4 — Verify subscription analytics
Should be fine — tier analytics is product-agnostic.

---

## Phase 10: Subscriptions & Payments

### Step 10.1 — Update `FeatureComparison.tsx`
Replace comparison table rows with ReelStudio feature matrix.

### Step 10.2 — Update `UpgradePrompt.tsx`
Verify feature names render as ReelStudio features (not calculator types).

### Step 10.3 — Read `subscription-success.tsx`
Update post-subscription CTA to go to `/studio/discover`.

### Step 10.4 — Verify checkout flow end-to-end
- Visit `/pricing` → click upgrade → verify plan descriptions are correct → complete test checkout

---

## Phase 11: Auth Pages

### Step 11.1 — Read `sign-in.tsx` and `sign-up.tsx`
Check for calculator/CalcPro references in translation keys used.

### Step 11.2 — Update auth layout marketing panel
Replace CalcPro pitch with ReelStudio pitch.

### Step 11.3 — Verify post-signup redirect
After account creation, user should land on `/studio/discover` (via `REDIRECT_PATHS.DASHBOARD` fix in Phase 3).

---

## Phase 12: Final Verification

### Functional Checklist
- [ ] Homepage shows ReelStudio content, no calculator references
- [ ] Sign in → lands on `/studio/discover`
- [ ] Sign up → lands on `/studio/discover`
- [ ] `/studio/discover` shows 3-panel layout with reels list
- [ ] Selecting a reel shows phone preview and analysis panel
- [ ] "Run Analysis" button calls AI and shows results
- [ ] "Generate" tab generates hooks/captions
- [ ] Generated content can be added to queue
- [ ] `/studio/queue` shows queued items
- [ ] Account page has Overview tab (not Calculator)
- [ ] Account > Subscription → Stripe billing works
- [ ] Pricing page shows ReelStudio tier features
- [ ] Footer links to Studio (not Calculators)
- [ ] Admin dashboard shows ReelStudio metrics
- [ ] No console errors on any page
- [ ] No "CalcPro" visible anywhere in the UI

### Quick Brand Audit
```bash
# Find any remaining CalcPro references in source code
grep -ri "calcpro" frontend/src/ --include="*.tsx" --include="*.ts" --include="*.json"
grep -ri "calcpro" backend/src/ --include="*.ts"

# Find any remaining calculator route references
grep -ri "/calculator" frontend/src/ --include="*.tsx" --include="*.ts"
grep -ri "calculator" frontend/src/ --include="*.tsx" --include="*.ts" | grep -v "// " | grep -v "test"
```

---

## Estimated Scope

| Phase | Files Changed | Effort |
|-------|--------------|--------|
| 0 — Verify | 0 | 15 min |
| 1 — Backend fixes | ~8 | 1 hour |
| 2 — Studio routing | Already done | 15 min verify |
| 3 — Constants & utils | ~5 | 30 min |
| 4 — Translations | 1 (en.json) | 1 hour |
| 5 — Homepage | 1 | 1 hour |
| 6 — Account page | ~4 | 1 hour |
| 7 — Navigation/layout | ~3 | 30 min |
| 8 — Public pages | ~11 | 2 hours |
| 9 — Admin audit | ~4 | 30 min |
| 10 — Payments/subscriptions | ~5 | 30 min |
| 11 — Auth pages | ~3 | 30 min |
| 12 — Final verification | 0 | 30 min |
| **Total** | **~54 files** | **~10 hours** |
