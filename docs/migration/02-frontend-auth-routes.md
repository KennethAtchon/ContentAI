# Frontend Auth Routes Migration

Files in `frontend/src/routes/(auth)/`.

---

## `src/routes/(auth)/sign-in.tsx`

**Current state**: Sign-in page. Likely shows the app name and a sign-in form. Functional — Firebase Auth is wired up and working.

**What must change**:
- Any hardcoded brand name or tagline should use `APP_NAME` from `app.constants.ts` (now "ReelStudio")
- If there's a "Welcome back to CalcPro" or similar string, update the translation key
- Logo/branding: should display ReelStudio logo/mark
- No structural changes — auth flow works fine

### Translation keys to check:
- `auth_sign_in_title` or similar — verify it doesn't say "CalcPro"
- `auth_sign_in_description` — check for calculator references

---

## `src/routes/(auth)/sign-up.tsx`

**Current state**: Sign-up page. Functional — creates Firebase user and redirects to dashboard.

**What must change**:
- Same as sign-in: check for any CalcPro brand mentions in translation keys used
- The post-signup redirect: currently redirects to `REDIRECT_PATHS.DASHBOARD` which is `/account?tab=calculator` — this needs to change to `/studio/discover`
- Any "Start calculating for free" → "Start analyzing reels for free"

### Translation keys to check:
- `auth_sign_up_title` — verify no CalcPro mention
- `auth_sign_up_description` — check for calculator references
- `auth_sign_up_cta` or similar — update CTA text

---

## Auth-adjacent files

### `src/shared/components/layout/auth-layout.tsx`
- Wraps sign-in/sign-up pages
- Likely shows brand logo and a marketing panel on the side
- Check for calculator/CalcPro mentions in the side panel text
- The brand panel should show ReelStudio copy: "Turn viral reels into your content strategy"

### `src/features/auth/components/auth-guard.tsx`
- No content changes needed — pure auth logic
- One change: `REDIRECT_PATHS.DASHBOARD` reference may need updating if that util is changed

### `src/features/auth/components/user-button.tsx`
- Avatar button with dropdown: Profile, Sign Out
- No brand text — likely fine as-is
- Verify no calculator-specific menu items
