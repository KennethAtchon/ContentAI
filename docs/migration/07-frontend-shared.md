# Frontend Shared Components Migration

Files in `frontend/src/shared/components/layout/` and related shared areas.

---

## `src/shared/components/layout/navbar.tsx`

**Current state**: Partially updated in this session.
- `APP_NAME` is now "ReelStudio" (via app.constants.ts)
- USER_ONLY_LINKS now shows "Discover" (studio_tabs_discover) linking to `/studio/discover`
- Active link detection updated

**Remaining issues to check**:
- Line 37: Comment still says `// Navigation configuration - SaaS Calculator App` → update comment
- `PUBLIC_NAVIGATION_LINKS`: Home, Pricing, FAQ, Contact — these are fine as-is
- Logo: Currently loads from `/logo.png` — will need a ReelStudio logo asset eventually (not blocking)

**No further code changes needed** — branding fix and logo swap are deferred to design phase.

---

## `src/shared/components/layout/footer-custom.tsx`

**Current state**: Footer has 4 columns:
1. **Brand column**: Logo + tagline + social links
2. **Product column**: Pricing, Calculators (link), FAQ, Contact
3. **Resources column**: Features, API Documentation, Support
4. **Contact column**: Address, City, Phone, Email

**What must change**:

### Brand column
- Tagline: Uses `shared_footer_company_tagline` translation key → update to ReelStudio tagline
- Social links: Fine as-is (generic social icons)

### Product column
- **"Calculators" link**: Uses `shared_footer_calculators` translation key and links to `/calculator` or similar
- **Replace with**: "Studio" → links to `/studio/discover`
- "Pricing", "FAQ", "Contact" links stay the same

### Resources column
- "Features" → fine, links to `/features`
- "API Documentation" → fine, links to `/api-documentation`
- "Support" → fine, links to `/support`

### Contact column
- `shared_footer_contact_email` translation → update from `support@calcpro.com` to `support@reelstudio.ai`
- Address/phone: update if they reference CalcPro

### Admin modal
- Footer has a hidden admin verification flow — keep as-is, it's functional

### Translation keys to update in footer:
- `shared_footer_company_tagline` — update to ReelStudio tagline
- `shared_footer_calculators` — rename to `shared_footer_studio` with value "Studio"
- `shared_footer_contact_email` — update email address
- `shared_footer_contact_phone` — verify/update
- `shared_footer_contact_street` — verify/update

---

## `src/shared/components/layout/page-layout.tsx`

**Current state**: Layout wrapper used by all pages. Has variants: `public` (with navbar + footer), `auth`, `admin`, `studio` (if added).

**What must change**:
- Verify that the studio pages use an appropriate layout variant (or no PageLayout — studio uses its own full-screen layout via `ais-root`)
- The `discover.tsx` wraps everything in `<AuthGuard>` and uses `ais-root` class, NOT `PageLayout` — this is correct
- **No changes needed** to this file if studio pages bypass it

---

## `src/shared/components/layout/customer-layout.tsx`

**Current state**: Layout for authenticated customer pages (`/account`, `/checkout`, etc.).

**What must change**:
- Likely wraps pages with navbar and possibly a breadcrumb or sidebar
- Check for any "Dashboard" or "My Calculators" labels in the sidebar/nav within this layout
- Replace any calculator references with ReelStudio equivalents

---

## `src/shared/components/layout/auth-layout.tsx`

**Current state**: Two-column layout for sign-in/sign-up. Left: form. Right: marketing panel.

**What must change**:
- The marketing panel (right side) likely has CalcPro copy: "Professional financial calculators..."
- Replace with ReelStudio copy: "Turn viral reels into your content strategy"
- The product name/logo on the right side: update to ReelStudio

### Translation keys to check:
- `auth_marketing_title` or similar — check what keys are used in auth-layout
- `auth_marketing_description` — update to ReelStudio pitch

---

## `src/shared/components/layout/main-layout.tsx`

**Current state**: The outermost layout (or alias for page-layout). May wrap everything.

**What must change**: Read and verify — likely no calculator-specific content here.

---

## `src/shared/components/layout/hero-section.tsx`

**Current state**: Reusable hero section component. Takes `badge`, `title`, `description` as props.

**What must change**: Nothing — it's a generic component. Content is passed via props from each page.

---

## `src/shared/components/layout/animated-section.tsx`

**Current state**: Animation wrapper for page sections.

**What must change**: Nothing — generic animation component.

---

## `src/shared/components/layout/error-boundary.tsx`

**Current state**: React error boundary component.

**What must change**: Possibly the error message text if it references CalcPro. Check the fallback UI text.

---

## `src/shared/components/custom-ui/section.tsx`

**Current state**: Section wrapper with variants (gradient, etc.).

**What must change**: Nothing — generic layout component.

---

## `src/shared/components/custom-ui/feature-card.tsx`

**Current state**: Reusable feature card component.

**What must change**: Nothing — generic component.

---

## `src/shared/components/custom-ui/empty-state.tsx`

**Current state**: Empty state component.

**What must change**: Nothing — generic.

---

## `src/shared/components/custom-ui/error-alert.tsx`

**Current state**: Error alert component.

**What must change**: Nothing — generic.

---

## `src/shared/components/marketing/structured-data.tsx`

**Current state**: SEO structured data injection.

**What must change**: Check if any CalcPro-specific structured data is hardcoded.

---

## `src/shared/services/seo/`

**Current state**: SEO metadata generation — page titles, descriptions, Open Graph data.

**What must change**:
- Site name in metadata: `APP_NAME` already updated to "ReelStudio"
- Description: `APP_DESCRIPTION` updated to ReelStudio copy
- Any hardcoded "financial calculator" references in metadata functions
- `generateFAQSchema` in structured-data.ts: fine, takes data as input

---

## Summary

| File | Action | Priority |
|------|--------|----------|
| `navbar.tsx` | Minor comment fix; logo swap deferred | Low |
| `footer-custom.tsx` | Update "Calculators" link → "Studio"; update email | High |
| `page-layout.tsx` | Verify; likely no changes | Low |
| `customer-layout.tsx` | Check for calculator labels | Medium |
| `auth-layout.tsx` | Update marketing panel copy | Medium |
| `main-layout.tsx` | Verify only | Low |
| `hero-section.tsx` | No changes | — |
| `animated-section.tsx` | No changes | — |
| `error-boundary.tsx` | Check fallback text | Low |
| `section.tsx` | No changes | — |
| `feature-card.tsx` | No changes | — |
| `empty-state.tsx` | No changes | — |
| `structured-data.tsx` | Check for hardcoded CalcPro | Low |
| `seo/` services | Verify no hardcoded calculator copy | Low |
