# Verification & Testing Strategy

This document outlines how to verify the UI unification changes at each phase of the migration.

---

## 1. Existing Test Suite

The project has **44 existing unit tests** under `frontend/__tests__/unit/`. These tests cover:

- Component rendering (error-boundary, auth-provider, query-provider, auth-guard, contact-form)
- Hooks (use-mobile, use-paginated-data, use-portal-link, use-query-fetcher)
- Services (payment-service, authenticated-fetch, safe-fetch, rate-limit, seo)
- Utilities (cn, date, pagination, data-validation, stripe-map-loader)
- Validation (api, auth, checkout, contact, file, input, search)
- Constants (subscription-constants)
- Permissions (calculator, core-feature)

### Running existing tests

```bash
cd frontend
bun test
```

### Impact Assessment

> [!IMPORTANT]
> The UI changes are **purely visual** — no logic, data, or API changes. Therefore:
> - ✅ All existing tests should continue to pass without modification
> - ❌ Most existing tests do NOT verify visual appearance
> - The tests that render components (error-boundary, auth-guard, contact-form, auth-provider) should still pass since we're changing CSS classes, not component structure

### Regression Check (Phase 0 — run first)

After every migration phase, run the full test suite to verify nothing is broken:

```bash
cd frontend && bun test
```

---

## 2. Build Verification

After CSS and component changes, verify the project still builds cleanly:

```bash
cd frontend && bun run build
```

This will catch:
- TypeScript errors from component API changes
- Missing imports for new components
- Tailwind class compilation issues

---

## 3. Visual Verification (Manual)

Since UI changes are visual by nature, manual browser verification is essential.

### Phase 0: CSS Foundation (after globals.css changes)

**Start the dev server:**
```bash
cd frontend && bun run dev
```

**Check each page category:**

| # | URL | What to verify |
|---|---|---|
| 1 | `http://localhost:5173/` | Home page renders with dark background, no white flashes |
| 2 | `http://localhost:5173/studio/discover` | Still looks correct (regression check) |
| 3 | `http://localhost:5173/sign-in` | Card and inputs have dark styling |
| 4 | `http://localhost:5173/pricing` | Cards and FAQ use dark palette |
| 5 | `http://localhost:5173/about` | Dark sections and cards |
| 6 | `http://localhost:5173/account` | Tabs and cards look dark (requires auth) |

### Phase 1: Layout Shell (after StudioShell + StudioTopBar changes)

| # | URL | What to verify |
|---|---|---|
| 1 | `http://localhost:5173/` | StudioTopBar present at top, 48px height, dark, logo visible |
| 2 | `http://localhost:5173/studio/discover` | StudioTopBar unchanged, still shows studio tabs |
| 3 | `http://localhost:5173/sign-in` | TopBar shows "auth" variant (logo + back), no old NavBar |
| 4 | `http://localhost:5173/features` | TopBar shows "public" variant with nav links, dark footer |
| 5 | `http://localhost:5173/account` | TopBar shows "customer" variant (requires auth) |

### Phase 2: Component Migration (after StudioHero + StudioSection + StudioFeatureCard)

| # | URL | What to verify |
|---|---|---|
| 1 | `http://localhost:5173/` | Hero has dark gradient, gradient text, dark cards in features grid |
| 2 | `http://localhost:5173/about` | StudioHero, dark mission card, dark value cards |
| 3 | `http://localhost:5173/features` | Dark feature cards with studio-accent icons |
| 4 | `http://localhost:5173/pricing` | Dark pricing cards with accent highlights |

### Phase 3: Page-by-Page Migration

After each page migration, visit the corresponding URL and verify:

1. ✅ No white or light-colored backgrounds visible
2. ✅ All text uses slate-200 opacity scale (not black/gray)
3. ✅ All accent colors are indigo (#818CF8) or purple (#C084FC)
4. ✅ All inputs have dark backgrounds with subtle borders
5. ✅ All buttons use gradient or ghost patterns
6. ✅ Loading states use shimmer skeletons
7. ✅ No scrollbars visible in the shell
8. ✅ Typography uses pixel-based sizes, Plus Jakarta Sans font
9. ✅ Page is responsive — check at 768px and 375px widths

### Full Regression Checklist (after all changes)

| Route | URL Path | Expected Result |
|---|---|---|
| Home | `/` | Dark hero, dark feature cards, dark social proof, dark CTA |
| Sign In | `/sign-in` | Dark centered card, dark inputs, gradient submit |
| Sign Up | `/sign-up` | Same as sign-in style |
| About | `/about` | Dark hero, dark sections, dark footer |
| Features | `/features` | Dark hero, dark feature grids, dark tier badges |
| Pricing | `/pricing` | Dark hero, dark pricing cards, dark FAQ accordion |
| FAQ | `/faq` | Dark accordion cards |
| Contact | `/contact` | Dark form card, dark inputs |
| Support | `/support` | Dark support cards |
| Privacy | `/privacy` | Dark content page |
| Terms | `/terms` | Dark content page |
| Cookies | `/cookies` | Dark content page |
| Accessibility | `/accessibility` | Dark content page |
| API Docs | `/api-documentation` | Dark content page |
| Account | `/account` | Dark tabs, dark overview card (requires auth) |
| Checkout | `/checkout` | Dark checkout form (requires auth) |
| Admin Dashboard | `/admin/dashboard` | Dark admin layout (requires admin auth) |
| Admin Settings | `/admin/settings` | Dark settings cards and form (requires admin auth) |
| Studio Discover | `/studio/discover` | Unchanged — still correct |
| Studio Generate | `/studio/generate` | Unchanged — still correct |
| Studio Queue | `/studio/queue` | Unchanged — still correct |
| 404 Page | `/nonexistent-page` | Dark 404 message |

---

## 4. Responsive Testing

Test each page at these viewport widths:

| Viewport | Device |
|---|---|
| 1440px | Desktop |
| 1024px | Tablet landscape |
| 768px | Tablet portrait |
| 375px | Mobile |

Key things to check on mobile:
- StudioTopBar hamburger menu works and is dark themed
- Content doesn't overflow horizontally
- Cards stack properly in single column
- Inputs and buttons are touch-friendly (min 44px height)

---

## 5. Accessibility Checks

After migration, verify:
- Color contrast: Text on dark backgrounds meets WCAA AA (4.5:1 ratio)
  - `#E2E8F0` on `#08080F` = 14.5:1 ✅
  - `#818CF8` on `#08080F` = 5.2:1 ✅
  - `rgba(226,232,240,0.4)` on `#08080F` = ~6.3:1 ✅
  - `rgba(226,232,240,0.25)` — use only for decorative text ⚠️
- Focus rings visible: `focus:border-studio-ring/50` should be clearly visible
- Keyboard navigation works for all interactive elements

---

## 6. Performance Check

After all changes, verify:

```bash
cd frontend && bun run build
```

Compare bundle sizes before/after. The CSS changes should not significantly increase bundle size since we're replacing classes, not adding new ones.

---

## 7. Automated E2E Tests (if applicable)

The project has a `frontend/e2e` directory. If Playwright tests exist:

```bash
# Check for existing e2e tests
ls frontend/e2e/
```

Run them after migration to ensure no functional regressions.

---

## 8. Suggested New Tests

Since the existing tests don't cover visual rendering, consider adding:

### Snapshot tests for key components
```typescript
// Example: Test that StudioShell renders with correct dark classes
describe("StudioShell", () => {
  it("renders with dark studio background", () => {
    const { container } = render(
      <StudioShell variant="public">Content</StudioShell>
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("bg-studio-bg");
    expect(shell.className).toContain("text-studio-fg");
    expect(shell.className).toContain("font-studio");
  });
});
```

> [!NOTE]
> These are suggestions for future test coverage. The migration itself can be verified by running the existing test suite + manual visual checks.
