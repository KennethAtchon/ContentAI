# Plan 05: Active Draft UX Rethink

**Fixes:** UX consequences of Bugs 2 + 4 (now that active draft is persisted, the UI should reflect it clearly)  
**Risk:** Low — frontend-only  
**Depends on:** Plan 01 (active draft must be reliably persisted before this is worth building)  
**Blocks:** Nothing

---

## Problem

The current UX for managing active drafts is opaque and requires two separate actions:

1. **Click a draft card** → previews the draft in `DraftDetail`, but does NOT change what the AI will iterate on.
2. **Click "Set Active" button** → actually changes `activeContentId`, which the AI uses.

Users don't understand why clicking a draft doesn't immediately make it the working context. The distinction between "viewing" and "activating" is not intuitive. The result: users often change drafts without noticing the AI is still iterating the old one.

Additionally:
- There is no visible indicator in the chat input area showing which draft the AI is currently working on.
- On session open, the active draft is not visually highlighted in the drafts list — the user has no way to know which one is "active" without clicking around.

---

## Changes

### 1. Collapse "Select" and "Set Active" into a single click

**File:** `frontend/src/features/chat/components/DraftsList.tsx`

Currently, `DraftsList` has two distinct interactions:
- Clicking a card calls `onSelect(draft)` — updates `selectedDraft` in ContentWorkspace
- The "Set Active" button calls `onSetActive(draft.id)` — updates `activeContentId` in useChatLayout

Collapse them: clicking a draft card should both preview it AND set it as active.

**Remove** the separate "Set Active" button entirely.

**Change `onSelect` prop** to call both `onActiveContentChange` and the local selection:

In `ContentWorkspace.tsx`, the `handleSelectDraft` handler becomes:

```typescript
const handleSelectDraft = (draft: SessionDraft) => {
  setSelectedDraft(draft);
  onActiveContentChange(draft.id); // ← now happens on every click, not just "Set Active"
};
```

Remove `handleSetActive` and the `onSetActive` prop from `DraftsList`. The component only needs `onSelect`.

### 2. Visual state: active draft is highlighted

**File:** `frontend/src/features/chat/components/DraftsList.tsx`

`DraftsList` receives `activeContentId` as a prop (it likely already does, or gets `drafts` + a selection indicator). Add a visible "active" state to the draft card:

- The active draft card gets a distinct highlighted border (e.g., `ring-2 ring-primary`) and a small "Active" badge or dot.
- The non-active drafts look normal.
- On session open, the active draft is immediately highlighted because `activeContentId` is now initialized from the persisted session value (Plan 01).

```typescript
// In DraftsList, on each card:
const isActive = draft.id === activeContentId;

<div
  className={cn(
    "draft-card ...",
    isActive && "ring-2 ring-primary"
  )}
  onClick={() => onSelect(draft)}
>
  {isActive && (
    <span className="badge">Active</span>
  )}
  {/* ... draft content */}
</div>
```

### 3. Chat input context indicator

**File:** `frontend/src/features/chat/components/ChatPanel.tsx` (or wherever the chat input lives)

Add a small non-intrusive line above or inside the chat input showing which draft is currently active:

```
Working on: "Why your morning routine is killing your gains"
```

This gives the user confidence that the AI knows which draft they're iterating. It should:
- Only show when `activeContentId` is set AND there is at least one draft in the session.
- Truncate the hook to ~60 characters with an ellipsis.
- Be styled subtly — secondary text color, small font — not a prominent UI element.
- Be clickable: clicking it opens the workspace sidebar to the drafts tab.

Implementation:

```typescript
// In ChatPanel (or wherever the send bar is rendered):
// Receive activeContentId and drafts as props, or access via context

const activeDraft = drafts.find((d) => d.id === activeContentId);

{activeDraft && (
  <button
    className="text-xs text-muted-foreground hover:text-foreground truncate max-w-xs"
    onClick={onOpenWorkspace}
  >
    Working on: "{activeDraft.generatedHook?.slice(0, 60) ?? "Draft"}"
  </button>
)}
```

The `drafts` and `activeContentId` are already available in `useChatLayout`. Pass them through to wherever the send bar renders, or expose `activeDraft` directly from `useChatLayout`:

```typescript
// In useChatLayout.ts — add to return value:
const activeDraft = useMemo(() =>
  sessionDraftsData?.drafts.find((d) => d.id === activeContentId) ?? null,
  [sessionDraftsData?.drafts, activeContentId]
);

return {
  // ... existing
  activeDraft,
};
```

### 4. Auto-activate on new content — now persists immediately

With Plan 01 in place, `onActiveContentChange` now calls `handleSetActiveDraft` which persists to the DB. The existing auto-activate effect in `ContentWorkspace.tsx:63-67` already calls `onActiveContentChange(streamingContentId)` — so new drafts auto-persist as active with no additional wiring. This just works.

### 5. Remove "Set Active" translation key

**File:** `frontend/src/translations/en.json`

Remove the translation entry for the "Set Active" button (whatever key it uses). No dead strings.

---

## DraftsList Props Before and After

**Before:**
```typescript
interface DraftsListProps {
  drafts: SessionDraft[];
  activeContentId: number | null;
  onSelect: (draft: SessionDraft) => void;
  onSetActive: (id: number) => void; // ← REMOVE
}
```

**After:**
```typescript
interface DraftsListProps {
  drafts: SessionDraft[];
  activeContentId: number | null;
  onSelect: (draft: SessionDraft) => void; // now implies "select + activate"
}
```

---

## Files Changed Summary

| File | Change |
|---|---|
| `frontend/src/features/chat/components/DraftsList.tsx` | Remove "Set Active" button, add active highlight + badge, remove `onSetActive` prop |
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | `handleSelectDraft` calls `onActiveContentChange`, remove `handleSetActive` |
| `frontend/src/features/chat/components/ChatPanel.tsx` | Add "Working on: [hook]" context indicator above send bar |
| `frontend/src/features/chat/hooks/useChatLayout.ts` | Expose `activeDraft` in return value |
| `frontend/src/translations/en.json` | Remove "Set Active" key |
