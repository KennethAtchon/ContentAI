# Unified Layout Project

## Goal

Make `/discover`, `/account`, and `/admin` feel like they belong to the same product — not three separate apps sharing a domain. The current layout inconsistencies create a jarring context-switch that breaks user trust, especially as users navigate between the studio and account management.

---

## What Makes Them Currently Jarring

### 1. Structural border token split

The most visually impactful difference is that **Discover uses `border-overlay-sm`** (a semi-transparent white overlay, `rgb(255 255 255 / 0.06)`) for all structural panel dividers, while **Account and Admin use `border-border`** (a solid dark gray-blue, `hsl(240 6% 20%)`).

At dark backgrounds, these resolve to different visual weights:
- `border-overlay-sm` = faint, almost invisible, "ghost" feel
- `border-border` = more defined, structural, "grounded" feel

This means the column separators on Discover look like they barely exist, while the sidebar dividers on Account/Admin are crisp and intentional. The same app, two different opinions on what a border is.

### 2. Navigation paradigm jump

- **Discover**: horizontal `StudioTopBar` — tabs across the top
- **Account/Admin**: vertical sidebar — sections down the left

This is the biggest structural difference and is **intentional** — Discover is a 3-column workspace tool, not a settings page. We are **not adding a sidebar to Discover**. Instead, we're aligning the design language around them so the navigation paradigm switch feels like a deliberate product decision rather than an accident.

### 3. Section label style inconsistency

- Discover sidebar uses `text-sm uppercase tracking-[1.5px] text-dim-3` for "SOURCE REELS"
- Account sidebar uses `text-[10px] uppercase tracking-widest text-dim-3` for "USAGE"

Both are uppercase/tracking labels but in different font sizes, making the sidebar panels read with different "weight" — Discover feels louder.

### 4. Panel surface color vs inherited background

- Discover's left sidebar: `bg-studio-surface` (surface-1, `hsl(240 28% 7%)`) — elevated above the page bg
- Account/Admin sidebar: inherits body bg (`hsl(230 25% 4%)`) — same level as content

This means Discover's sidebar panel is visually raised while account/admin's is flush with the page, making the spatial hierarchy differ across pages.

---

## What We're Changing

### Discover page (`studio/discover.tsx` + panel components)

**Border token standardization** — the highest-impact change:

| Element | Before | After |
|---|---|---|
| Left sidebar right border | `border-r border-overlay-sm` | `border-r border-border` |
| Niche selector bottom divider | `border-b border-overlay-sm` | `border-b border-border` |
| Resize handle top border | `border-t border-overlay-sm` | `border-t border-border` |
| Right panel left border | `border-l border-overlay-sm` | `border-l border-border` |
| Load more button border | `border border-overlay-sm` | `border border-border` |
| AnalysisPanel left border | `border-l border-overlay-sm` | `border-l border-border` |

**Note**: Card-level decorative borders (like audio track items, metric cells) keep `border-overlay-sm` — that's intentional and matches how Account/Admin use overlay borders for inset cards.

**Section label sizing** in `ReelList.tsx`:
- Downsize from `text-sm` to `text-[10px]` to match account sidebar's section label scale

---

## What We're NOT Changing

- **No sidebar on Discover.** The 3-column workspace layout is load-bearing for the tool's UX. Navigation paradigms can differ by page type; what matters is that they share visual language.
- **No changes to `StudioTopBar`** border — `border-b border-overlay-sm` stays on the top bar because it's part of the app shell, not a panel divider.
- **No changes to card borders** (`border-overlay-sm` on metric cells, audio items) — these are decorative, not structural, and match how account/admin components use overlay borders internally.
- **No layout rewrite of Discover** — only token corrections, not structural changes.

---

## Why This Works

The goal of unified layout is **shared design language**, not identical layout. A settings page (sidebar + content) and a workspace tool (multi-column) inherently have different layouts — that's correct. What breaks the experience is when the **visual atoms** (borders, colors, type scale) feel like they came from different design systems.

After these changes:
- Dividing lines across all three pages resolve to the same `border-border` token
- Surface color depth on Discover is slightly elevated (surface-1 sidebar) which is valid — it's a panel, not a sidebar
- Section labels across all pages use the same small-caps style
- The user's eye reads the same material language whether they're in the workspace or account settings

---

## Status

- [x] Border token standardization in `discover.tsx`
- [x] Border token update in `AnalysisPanel.tsx`
- [x] Section label scale fix in `ReelList.tsx`
