# Investigation: Editor Versioning & Queue Version History

**Date:** 2026-03-22

| Issue | Status |
|---|---|
| Issue 1 — Editor duplicate projects on iteration | ✅ Fixed (`backend/src/routes/editor/index.ts`) |
| Issue 2 — Queue version history not visible | ✅ Fixed (`backend/src/routes/queue/index.ts`, `frontend/src/routes/studio/queue.tsx`) |

---

## Summary

Two related issues both stem from how the app handles the **content version chain** (v1 → v2 → v3 via `iterate_content`):

1. **Editor creates a new project for every content version** — this is a **bug**. Each iteration should update the existing editor project to track the new tip, not spawn a brand new project.

2. **Queue doesn't show older versions** — this is a **bug** in the UI. The backend computes `versionCount` correctly but the frontend never uses it, and the "stack" view that shows multiple versions is only triggered when multiple separate queue items exist (which the current design prevents).

---

## Issue 1: Editor Duplicate Projects on Iteration ✅ Fixed

### Is it a feature or a bug?

**It's a bug.** The intended design (evidenced by the schema's partial unique index `edit_project_unique_content_root` on `generated_content_id WHERE parent_project_id IS NULL`) is that one root editor project exists per content chain. The index was built to prevent duplicates — but the auto-create call upstream breaks this by passing the *new version's ID* instead of the *chain root's ID*.

### Root Cause

Two gaps compound to cause the bug:

**Gap A — Frontend fires with wrong ID.**

`frontend/src/features/chat/components/ChatLayout.tsx:276–297`

```typescript
useEffect(() => {
  if (!streamingContentId) return;
  void authenticatedFetchJson("/api/editor", {
    method: "POST",
    body: JSON.stringify({ generatedContentId: streamingContentId }),
  })
}, [streamingContentId]);
```

`streamingContentId` is set in `use-chat-stream.ts:141` directly from the `tool-output-available` event's `contentId`. For `iterate_content`, that ID is the **new version's ID** (e.g. `11`), not the chain root (e.g. `10`).

**Gap B — Backend upsert doesn't walk up the chain.**

`backend/src/routes/editor/index.ts:302–315`

```typescript
const [existing] = await db
  .select()
  .from(editProjects)
  .where(
    and(
      eq(editProjects.userId, auth.user.id),
      eq(editProjects.generatedContentId, generatedContentId),
    ),
  )
  .limit(1);

if (existing) {
  return c.json({ project: existing }, 200);
}
// ... else INSERT new project
```

When `generatedContentId = 11` is passed, no project exists for it, so a new one is created — even though a project already exists for `10` (the chain root). The upsert does not resolve the chain root first.

### Desired Behaviour

When content is iterated (v1 → v2):
- **One** editor project exists per content chain — never two.
- The existing editor project's `generatedContentId` is updated to point to the new tip (v2).
- The editor project's **timeline is rebuilt** from v2's data (new hook, script, scene description) so the editor reflects the new version when the user opens it.
- The project's title stays the same unless the user renamed it.

### Fix Plan

The fix lives entirely in the **backend** `POST /api/editor` handler. The frontend call does not need to change — the backend should handle any `generatedContentId` it receives, new or existing version, and do the right thing.

#### Step 1 — Walk up `parent_id` to find the chain root

Before the upsert lookup, resolve the root of the content chain:

```typescript
// Resolve chain root by walking parent_id
async function resolveChainRoot(contentId: number, userId: string): Promise<number> {
  let currentId = contentId;
  while (true) {
    const [row] = await db
      .select({ id: generatedContent.id, parentId: generatedContent.parentId })
      .from(generatedContent)
      .where(and(eq(generatedContent.id, currentId), eq(generatedContent.userId, userId)))
      .limit(1);
    if (!row || row.parentId == null) return currentId;
    currentId = row.parentId;
  }
}
```

#### Step 2 — Upsert using the chain root ID

```typescript
const chainRootId = await resolveChainRoot(generatedContentId, auth.user.id);

const [existing] = await db
  .select()
  .from(editProjects)
  .where(
    and(
      eq(editProjects.userId, auth.user.id),
      eq(editProjects.generatedContentId, chainRootId),
      isNull(editProjects.parentProjectId),
    ),
  )
  .limit(1);
```

#### Step 3 — If project exists, update it with the new version's data

When an existing project is found:
1. Update `generatedContentId` to point to the new tip (the ID that was passed in).
2. Rebuild the timeline from the new version's content by calling `buildInitialTimeline(generatedContentId, userId)`.
3. Update `tracks` and `durationMs` on the project with the rebuilt timeline.

```typescript
if (existing) {
  const { tracks, durationMs } = await buildInitialTimeline(generatedContentId, auth.user.id);

  const [updated] = await db
    .update(editProjects)
    .set({
      generatedContentId,   // now points to new tip
      tracks,               // rebuilt from new version's script/scenes
      durationMs,
    })
    .where(eq(editProjects.id, existing.id))
    .returning();

  return c.json({ project: updated }, 200);
}
```

If it's a brand new chain (no existing project), fall through to the existing INSERT logic unchanged.

### Affected Files

| File | Change |
|---|---|
| `backend/src/routes/editor/index.ts:285–316` | Add `resolveChainRoot` helper; upsert using root ID; on match, update `generatedContentId` + rebuild timeline via `buildInitialTimeline` |
| `frontend/src/features/chat/components/ChatLayout.tsx:325–344` | No change — continues passing the new version ID, backend handles it correctly |

---

## Issue 2: Queue Doesn't Show Older Content Versions ✅ Fixed

### Root Cause

Three facts combine to make the version history invisible:

**Fact 1 — `iterate_content` migrates the queue item instead of creating a second one.**

`backend/src/lib/chat-tools.ts:610–634`

```typescript
const existing = await findChainQueueItem(tx, effectiveParent.id, userId);
if (existing) {
  await tx.update(queueItems)
    .set({ generatedContentId: inserted.id })   // ← moves forward, doesn't clone
    .where(eq(queueItems.id, existing.queueItemId));
}
```

After v1 → v2, there is exactly **one** `queue_item` row, pointing to v2. v1 is orphaned in `generated_content` with no queue item.

**Fact 2 — `GET /api/queue` only returns rows that exist in `queue_items`.**

`backend/src/routes/queue/index.ts:236–323`

The query joins `queueItems` to `generatedContent`. Since only v2 has a queue item, only v2 is returned. The backend does compute `versionCount` via a recursive CTE (lines 349–418) but this is purely informational.

**Fact 3 — Frontend only shows the stack view when `group.items.length > 1`.**

`frontend/src/routes/studio/queue.tsx:215–233, 328–364`

```typescript
const versionGroups = useMemo(() => {
  for (const item of items) {
    const key = item.rootContentId;
    const siblings = items.filter((i) => i.rootContentId === key);
    groups.push({ rootContentId: key, items: siblings });
  }
  return groups;
}, [items]);

// ...

{group.items.length > 1 ? (
  <StackedQueueCard items={group.items} />     // ← never renders
) : (
  <QueueListItem item={group.items[0]} />
)}
```

`StackedQueueCard` never renders because every group has exactly one item. The `versionCount` field on `QueueItem` is never read anywhere in the UI.

### Fix Plan

The core problem is that **version history information reaches the queue detail panel but the UI doesn't surface it**. The fix is to use `versionCount` (already computed by the backend) to display older versions in the detail panel.

#### Step 1 — Backend: Include full version chain in queue item detail

Modify `GET /api/queue` (or `GET /api/queue/:id`) to also return the full version chain for the content linked to a queue item. The recursive CTE for `rootContentId` already walks the chain — extend it to also return each ancestor content row as a `versions` array on the response.

```typescript
// Add to QueueItem response shape:
versions: Array<{
  id: number;
  version: number;
  hook: string;
  caption: string;
  createdAt: string;
}>
```

This requires joining the recursive CTE results back to `generated_content` and aggregating as JSON.

#### Step 2 — Frontend: Show version selector in Queue Detail Panel

In the queue detail panel, when `item.versionCount > 1` (or `item.versions.length > 1`), render a version navigator:

```
◀  Version 1 of 3  ▶
```

Selecting a version swaps the displayed content (hook, caption, script) in the detail panel to that version's data. This is **read-only** — the user is viewing history, not changing which version the queue item tracks.

#### Step 3 — Frontend: "Promote to this version" action (optional enhancement)

Add a "Use this version" button when viewing an older version in the detail panel. This calls:

```
PATCH /api/queue/:id { generatedContentId: <older_version_id> }
```

...to roll back the queue item to point to an earlier version.

#### Step 4 — Fix StackedQueueCard trigger (use versionCount, not item count)

Update the grouping logic to show a visual "multiple versions" indicator based on `versionCount` rather than the number of queue items in the group:

```typescript
// Instead of:
{group.items.length > 1 ? <StackedQueueCard /> : <QueueListItem />}

// Use:
{group.items[0].versionCount > 1 ? (
  <QueueListItem item={group.items[0]} hasVersions />
) : (
  <QueueListItem item={group.items[0]} />
)}
```

The `hasVersions` prop can trigger a visual "V3" badge or stacked-paper visual on the card.

### Affected Files

| File | Change |
|---|---|
| `backend/src/routes/queue/index.ts:236–418` | Extend recursive CTE to return full `versions` array per queue item |
| `frontend/src/routes/studio/queue.tsx:215–364` | Update grouping logic to use `versionCount`; render version badge on cards |
| `frontend/src/features/reels/types/reel.types.ts:62–87` | Add `versions` array to `QueueItem` type |
| Queue detail panel component (wherever it renders content fields) | Add version navigator UI (`◀ v1 / v2 / v3 ▶`) |

---

## Implementation Order

```
1. Fix Issue 1 (Editor) — backend walk-up-chain fix (1–2 hours)
2. Fix Issue 1 (Editor) — frontend root resolution (30 min)
3. Fix Issue 2 (Queue) — backend versions array in response (1–2 hours)
4. Fix Issue 2 (Queue) — frontend version navigator in detail panel (2–3 hours)
5. Fix Issue 2 (Queue) — versionCount badge on queue cards (30 min)
```

---

## Non-Goals

- **Do not** change the queue-item-per-chain-uniqueness rule (`assertNoChainQueueItem`). One queue item per chain is the correct design; we surface older versions through the detail panel, not through separate queue items.
- **Do not** backfill historical data — the version history will only work for newly iterated content going forward (and for any `generated_content` rows reachable via `parent_id` from the current queue item's content).

---

## Related Code Locations

| Concern | File | Lines |
|---|---|---|
| Auto-create editor on stream | `frontend/src/features/chat/components/ChatLayout.tsx` | 276–297 |
| streamingContentId source | `frontend/src/features/chat/hooks/use-chat-stream.ts` | 130–143 |
| Editor POST upsert | `backend/src/routes/editor/index.ts` | 285–316 |
| iterate_content tool | `backend/src/lib/chat-tools.ts` | 584–648 |
| edit_projects schema + unique index | `backend/src/infrastructure/database/drizzle/schema.ts` | 476–523 |
| GET /api/queue query | `backend/src/routes/queue/index.ts` | 236–323 |
| Recursive CTE for versionCount | `backend/src/routes/queue/index.ts` | 349–418 |
| Queue iterate_content migration | `backend/src/lib/chat-tools.ts` | 610–634 |
| Queue version grouping (frontend) | `frontend/src/routes/studio/queue.tsx` | 215–364 |
| QueueItem type | `frontend/src/features/reels/types/reel.types.ts` | 62–87 |
| generated_content schema | `backend/src/infrastructure/database/drizzle/schema.ts` | 203–233 |
| queue_items schema | `backend/src/infrastructure/database/drizzle/schema.ts` | 266–289 |
