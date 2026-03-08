# 02 — UI Shell: Implementing the AIStudioDesign Layout

## Goal

Replace the current generic SaaS UI with the studio layout from `AIStudioDesign.jsx`. This becomes the core authenticated experience — everything else is built on top of it.

---

## New Route Structure

Current routes (after cleanup from step 07):
```
(public)/    → landing, pricing
(auth)/      → sign-in, sign-up
(customer)/  → [OLD] account pages
admin/       → admin dashboard
```

New routes:
```
(public)/           → new landing page (studio-focused)
(auth)/             → sign-in, sign-up (unchanged)
studio/             → main studio layout (replaces customer/)
  studio/discover   → Discover tab
  studio/generate   → Generate tab
  studio/edit       → Edit tab
  studio/queue      → Queue tab
admin/              → unchanged
```

---

## Files to Create

### 1. Studio Layout Shell

**`frontend/src/routes/studio/__root.tsx`**

Implements the three-panel layout from `AIStudioDesign.jsx`:
- Top bar with logo, tab navigation, niche search
- Left sidebar (reel list + AI tool shortcuts)
- Center canvas area (phone preview + toolbar)
- Right AI panel (Analysis / Generate / History tabs)

Use TanStack Router's `<Outlet />` inside the canvas area to render tab content.

### 2. Studio CSS / Design Tokens

**`frontend/src/styles/studio.css`**

Extract all `ais-*` CSS from `AIStudioDesign.jsx` into a dedicated stylesheet. Import it in the studio layout root. This keeps component files clean.

Key classes to extract:
- `.ais-root`, `.ais-topbar`, `.ais-logo`, `.ais-tabs`, `.ais-tab`
- `.ais-layout`, `.ais-sidebar`, `.ais-asset`, `.ais-asset-list`
- `.ais-canvas`, `.ais-canvas-body`, `.ais-phone`, `.ais-phone-*`
- `.ais-float-card`, `.ais-canvas-toolbar`, `.ais-toolbar-btn`
- `.ais-ai-panel`, `.ais-panel-tab`, `.ais-panel-body`
- `.ais-metric-tile`, `.ais-hook-display`, `.ais-generate-*`

### 3. Tab Pages

**`frontend/src/routes/studio/discover.tsx`** — Main view: reel list + phone canvas + analysis panel. This is the primary landing view after login.

**`frontend/src/routes/studio/generate.tsx`** — Full-screen AI generation workspace. Prompt input, output viewer, history.

**`frontend/src/routes/studio/edit.tsx`** — Reel editor: trim, caption overlay, audio picker.

**`frontend/src/routes/studio/queue.tsx`** — Scheduled content queue with status (draft / scheduled / posted).

---

## Key Components to Build

### `ReelList`
**`frontend/src/features/reels/components/ReelList.tsx`**

The left sidebar list. Renders each reel as an `ais-asset` item with:
- Thumbnail emoji or avatar
- Username
- Views + engagement rate

Props: `reels: Reel[]`, `activeId: number`, `onSelect: (id) => void`

### `PhonePreview`
**`frontend/src/features/reels/components/PhonePreview.tsx`**

The center canvas phone mockup. Renders:
- Simulated phone frame with notch
- Gradient background
- Floating stat cards (engagement, views, posted, likes)
- Hook text overlay
- Social action buttons (like, comment, share)

Props: `reel: Reel`

### `AnalysisPanel`
**`frontend/src/features/reels/components/AnalysisPanel.tsx`**

Right panel with three sub-tabs:
- **Analysis**: metrics grid, hook, caption, audio, remix suggestion
- **Generate**: textarea prompt + generate button + result display
- **History**: list of previously generated outputs

Props: `reel: Reel`, `analysis: ReelAnalysis | null`

### `StudioTopBar`
**`frontend/src/features/studio/components/StudioTopBar.tsx`**

Logo, tab navigation, niche search input, scan button.

---

## Translation Keys to Add

Add to `frontend/src/translations/en.json` under a `studio` namespace:

```json
{
  "studio": {
    "tabs": {
      "discover": "Discover",
      "generate": "Generate",
      "edit": "Edit",
      "queue": "Queue"
    },
    "sidebar": {
      "sourceReels": "Source Reels",
      "aiTools": "AI Tools"
    },
    "tools": {
      "hookWriter": "Hook Writer",
      "captionAI": "Caption AI",
      "remix": "Remix",
      "voiceOver": "Voice-over",
      "scheduler": "Scheduler"
    },
    "panel": {
      "analysis": "Analysis",
      "generate": "Generate",
      "history": "History",
      "metrics": "Metrics",
      "hook": "Hook",
      "caption": "Caption",
      "audio": "Audio",
      "remixSuggestion": "Remix Suggestion"
    },
    "generate": {
      "label": "AI Generate",
      "placeholder": "Describe what to create...",
      "button": "Generate",
      "generating": "Generating..."
    },
    "search": {
      "placeholder": "Search niche...",
      "scan": "Scan"
    }
  }
}
```

---

## State Management

The studio has three key pieces of shared state:

1. **Active niche query** — string, stored in URL search params (`?q=personal+finance`) so it's shareable and persists on refresh.
2. **Selected reel ID** — stored in URL search params (`?reel=1`) for the same reasons.
3. **Active panel tab** — local component state (no need to persist).

Use TanStack Router's `useSearch` and `useNavigate` to sync query + reel selection with the URL.

---

## Data Fetching

Use TanStack Query to fetch reels. Define query keys in `src/shared/lib/query-keys.ts`:

```typescript
// Add to queryKeys.api:
reels: (niche: string) => ["reels", niche] as const,
reelAnalysis: (reelId: number) => ["reel-analysis", reelId] as const,
```

Use `useQueryFetcher` (per CLAUDE.md patterns) for all GET requests:

```typescript
const fetcher = useQueryFetcher();
const { data: reels } = useQuery({
  queryKey: queryKeys.api.reels(niche),
  queryFn: () => fetcher(`/api/reels?niche=${encodeURIComponent(niche)}`),
  enabled: !!niche,
});
```

---

## Acceptance Criteria

- [ ] Navigating to `/studio` redirects authenticated users to `/studio/discover`
- [ ] Unauthenticated users are redirected to `/sign-in`
- [ ] Three-panel layout renders correctly at 1280px+ viewport
- [ ] Tab navigation updates the active tab visually and routes correctly
- [ ] Reel list renders with mock data (before real API is wired)
- [ ] Selecting a reel updates the phone preview and analysis panel
- [ ] Niche search input updates the URL search param on submit
- [ ] All visible strings use `t()` from `useTranslation()`
