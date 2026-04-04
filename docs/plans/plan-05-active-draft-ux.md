# Plan 05: Active Draft UX Rethink

**Fixes:** active draft is persisted but still not obvious in everyday chat workflow  
**Risk:** Low - frontend-only  
**Depends on:** Plan 01  
**Blocks:** Nothing

---

## Current UX

The current workspace already has some good pieces:

- `DraftsList.tsx` visually marks the active draft
- `DraftDetail.tsx` can show whether the opened draft is active
- there is a separate "Set Active" action

The remaining issue is that viewing and activating are still split across multiple clicks, and the composer area does not clearly tell the user what the AI is about to iterate.

---

## UX Direction

### 1. Clicking a draft row should activate it and open its detail view

**Files:** `frontend/src/features/chat/components/ContentWorkspace.tsx`, `frontend/src/features/chat/components/DraftsList.tsx`

Change `handleSelectDraft` so it performs both actions:

```typescript
const handleSelectDraft = (draft: SessionDraft) => {
  setSelectedDraft(draft);
  onActiveContentChange(draft.id);
};
```

Then remove the extra "Set Active" affordance from `DraftsList`.

This matches the user's mental model: the draft they click is the draft they are now working on.

### 2. Keep the active styling, but make it survive navigation cleanly

`DraftsList` already highlights the active draft. Keep that pattern and ensure it remains correct after:

- session reload
- session switch
- auto-activation of a newly generated draft

### 3. Surface the active draft near the composer

**File:** `frontend/src/features/chat/components/ChatPanel.tsx`

Add a small line above the input:

```text
Working on: "Why your morning routine is killing your gains"
```

Rules:

- only show when an active draft exists
- truncate long hooks
- clicking the indicator opens the workspace
- styling stays subtle; this is context, not a headline

### 4. Reuse existing draft-selection components where sensible

There is already a `DraftPicker.tsx` in the chat feature. If it fits the composer area, prefer reusing or adapting that component instead of inventing a second independent draft selector.

---

## Non-goals

- changing the persisted active-draft data model
- adding another modal or drawer just for draft context
- introducing separate "selected" and "active" concepts again under new names

---

## Files Changed Summary

| File | Change |
|---|---|
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Make draft selection activate immediately |
| `frontend/src/features/chat/components/DraftsList.tsx` | Remove separate "Set Active" affordance; rely on row click |
| `frontend/src/features/chat/components/ChatPanel.tsx` | Show the current active draft near the composer |
| `frontend/src/features/chat/hooks/useChatLayout.ts` | Expose active draft data needed by the composer indicator |
