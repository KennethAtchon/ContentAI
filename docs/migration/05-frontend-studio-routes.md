# Frontend Studio Routes Migration

Files in `frontend/src/routes/studio/` and related feature components.

---

## Current State

The studio routes were built in a previous migration pass but have a **critical routing bug**:

### Bug: Infinite Redirect Loop (FIXED in this session)

`src/routes/studio.tsx` was set up as both the parent layout and a redirector:
```tsx
// OLD - WRONG
export const Route = createFileRoute("/studio")({
  beforeLoad: () => { throw redirect({ to: "/studio/discover" }); },
  component: () => null,
});
```

In TanStack Router, `studio.tsx` is the **parent layout route** for all `studio/*.tsx` children. Its `beforeLoad` runs for EVERY visit to `/studio/*`, including `/studio/discover`, causing an infinite redirect loop — the page never renders.

**Fix applied**:
- `studio.tsx` → now renders `<Outlet />` (pass-through layout)
- `studio/index.tsx` → new file, handles the `/studio` → `/studio/discover` redirect

---

## Studio Route Files

### `src/routes/studio.tsx` ✅ Fixed
```tsx
// NEW - CORRECT
export const Route = createFileRoute("/studio")({
  component: () => <Outlet />,
});
```
No further changes needed.

---

### `src/routes/studio/index.tsx` ✅ Created
Redirects `/studio` → `/studio/discover`. No further changes needed.

---

### `src/routes/studio/discover.tsx`

**Current state**: The main 3-panel studio UI:
- Left sidebar: reel list + AI tool shortcuts
- Center: phone preview + toolbar
- Right: analysis/generate/history panel

**Known issues to verify after routing fix**:
1. Does the page render when the user IS logged in? (AuthGuard with `authType="user"`)
2. Does the reel list populate? (depends on backend having seeded reels)
3. Does the `studio.css` load correctly? (imported at top of file)

**Potential remaining issues**:
- `useReels` hook: `enabled: !!user && !!niche` — if user is not loaded yet, shows loading state. This is correct behavior.
- Empty reel list: if no reels are seeded in the database, the list will be empty. Need to run `bun run src/scripts/seed-mock-reels.ts` in backend.
- `studio_tools_*` translation keys: verify all exist in `en.json`

**No structural changes needed** — the 3-panel layout is the intended final state.

---

### `src/routes/studio/generate.tsx`

**Current state**: Full-screen generation workspace.

**What to verify**:
- Read the file to confirm it's complete
- Check that it imports from `@/features/generation/hooks/use-generation`
- Verify AuthGuard is present
- Verify all translation keys used exist in `en.json`

---

### `src/routes/studio/queue.tsx`

**Current state**: Content queue with status filters.

**What to verify**:
- Read the file to confirm it's complete
- Check the status filter options match what the backend returns (`draft`, `queued`, `posted`, `failed`)
- Verify AuthGuard is present
- Verify all translation keys used exist in `en.json`

---

## Studio Feature Components

### `src/features/studio/components/StudioTopBar.tsx` ✅

**Current state**: Top navigation bar for studio pages. Shows:
- Logo ("✦ ReelStudio")
- Tab navigation (Discover, ✦ Generate, Queue)
- Niche search input + Scan button

**Known issue**: Unused `useNavigate` import was removed in a previous pass.
**Status**: Complete. No further changes needed.

---

### `src/features/reels/components/ReelList.tsx` ✅

**Status**: Complete. Shows list of reels with emoji thumbnail, username, views, engagement rate.

---

### `src/features/reels/components/PhonePreview.tsx` ✅

**Status**: Complete. Shows phone mockup with floating stat cards (engagement, views, likes, posted date).

---

### `src/features/reels/components/AnalysisPanel.tsx` ✅

**Status**: Complete. Has 3 tabs:
- **Analysis**: reel metrics, hook display, caption, audio, AI analysis tags + run analysis button
- **Generate**: prompt input + generate button + result display with copy/queue actions
- **History**: list of previously generated content

---

### `src/features/reels/hooks/use-reels.ts` ✅

**Status**: Complete. `useReels(niche)`, `useReel(id)`, `useAnalyzeReel()`.

---

### `src/features/reels/types/reel.types.ts` ✅

**Status**: Complete. `Reel`, `ReelDetail`, `ReelAnalysis`, `GeneratedContent`, `QueueItem` interfaces.

---

### `src/features/generation/hooks/use-generation.ts` ✅

**Status**: Complete. `useGenerationHistory()`, `useGenerateContent()`, `useQueueContent()`.

---

## Studio CSS

### `src/styles/studio.css`

**Status**: Complete. ~500 lines of `ais-*` CSS classes extracted from AIStudioDesign.jsx reference.
Dark theme: `#08080F` background, `#0C0C18` surfaces, `#818CF8`/`#C084FC` accents.

**Verify**: Does this file get imported correctly in the Docker container? The file is imported at the top of `discover.tsx` as `import "@/styles/studio.css"`.

---

## What's Blocking the Studio from Working

1. **Routing bug**: FIXED (studio.tsx now renders `<Outlet />`)
2. **Empty database**: No reels seeded → reel list shows empty state. Run seed script.
3. **ANTHROPIC_API_KEY missing**: AI analysis will fail without this env var in backend
4. **User must be logged in**: AuthGuard redirects to sign-in if not authenticated — this is correct behavior

## Action Items After Routing Fix
1. Seed the database: `cd backend && bun run src/scripts/seed-mock-reels.ts`
2. Add `ANTHROPIC_API_KEY` to `backend/.env`
3. Sign in to the app and navigate to `/studio/discover`
4. Verify the 3 panels render
5. Select a reel and test the "Run Analysis" button
