# Draft Sync & Multi-Draft Design: Problems and Proposed Solution

**Status**: Design proposal  
**Area**: `/generate` chat + `/editor` sync  
**Scope**: Draft lifecycle, active draft state, multi-draft per message, universal sync

---

## Executive Summary

The current system has four distinct failure modes:

1. **Sync is one-shot** — editor projects are initialized from a draft once, then the two systems diverge permanently.
2. **Active draft is ephemeral** — it resets on every reload and is never persisted anywhere; the AI has no reliable anchor.
3. **A single chat message is structurally capped at one draft** — `chat_messages.generatedContentId` is a scalar. Multi-draft generation silently drops all but the last.
4. **The AI corrects its own conversation history** — when `activeContentId` is not explicitly set by the user (or resets), the AI is told to iterate on the wrong draft, producing responses that contradict what it said earlier.

These aren't edge cases. They are the normal flow for any user who uses the product for more than one session.

---

## Part 0: Sync Contract — What Each Side Owns

Before defining bugs or solutions, the boundary has to be explicit. Sync only makes sense once you know what each side cares about keeping current and what it treats as private.

### What Chat (/generate) Owns

Chat owns the **content of the draft** — the text and metadata fields on `generated_content`:

| Field | Owned by |
|---|---|
| `generatedHook` | Chat |
| `generatedScript` | Chat |
| `voiceoverScript` | Chat |
| `postCaption` | Chat |
| `sceneDescription` | Chat |
| `generatedMetadata` (hashtags, CTA, contentType) | Chat |
| `status` (draft → ready → ...) | Chat |
| `version` + `parentId` (iteration chain) | Chat |

Chat also owns:
- Which session a draft belongs to (via `chat_messages → chat_message_drafts`)
- Which draft is active in a session (`chat_sessions.activeContentId`)
- Message history and conversation context
- Reel references attached to messages

**Chat does not know or care about:**
- How the editor has arranged clips on the timeline
- Whether a shot has been trimmed, repositioned, or recolored
- What tracks exist in the editor project
- Whether the project has been exported or published
- Any visual effects, text overlays, or user-added media

---

### What Editor (/editor) Owns

The editor owns the **timeline** and all decisions about how the video is assembled:

| Data | Owned by |
|---|---|
| Track layout (order, type, name) | Editor |
| Clip positions (`startMs`) | Editor |
| Clip trims (`trimStartMs`, `trimEndMs`, `durationMs`) | Editor |
| Clip transforms (scale, rotation, positionX/Y, opacity, warmth, contrast) | Editor |
| Clip volume / mute state | Editor |
| User-added clips (`source: "user"`) | Editor |
| Caption preset and doc | Editor |
| Text overlays | Editor |
| Project FPS, resolution | Editor |
| Export jobs and render state | Editor |
| Published status | Editor |

**Editor does not push anything back to chat.** Sync is unidirectional: chat → editor. The editor never modifies a `generated_content` record.

---

### What Crosses the Boundary (Chat → Editor)

Sync is triggered when content assets change. The specific data that crosses is:

| What changes in chat | What updates in editor |
|---|---|
| New voiceover audio asset linked to content | Audio track clip `assetId` + `durationMs` |
| New background music asset linked to content | Music track clip `assetId` + `durationMs` |
| New video shot asset linked to content | Video track clip `assetId` + `durationMs` (placeholder → real, or appended) |
| `generatedHook` changes | `edit_projects.generatedHook` (denormalized) + project `title` if `autoTitle = true` |
| `postCaption` changes | `edit_projects.postCaption` (denormalized) |

Everything else on `generated_content` (script, voiceoverScript, sceneDescription, hashtags, CTA) is chat's private data. The editor doesn't render any of it directly — those fields inform asset generation (TTS, video shots), and it's the resulting **assets** that cross the boundary, not the text fields themselves.

---

### What Never Syncs (Each Side's Private State)

**Chat's private state — editor never reads or writes:**
- Message history
- `generatedScript`, `voiceoverScript`, `sceneDescription`, `generatedMetadata`
- Session/project organization, streaming state

**Editor's private state — chat never reads or writes:**
- Clip trims and transforms
- Track order and structure
- User-added clips (`source: "user"`)
- Caption docs
- Export/render jobs
- `fps`, `resolution`, `publishedAt`, `status`

This boundary means editor autosave changes will **never trigger a sync back to chat**. A user dragging a clip to a new position, trimming a shot, or adding their own B-roll has zero effect on the `generated_content` record. The two systems evolve independently in their own domains — they are only coupled at the asset handoff.

---

## Part 1: Current Bugs in Detail

### Bug 1: Sync is One-Shot, Not Universal

**What happens now:**

When you click "Open in Editor" on a draft, `POST /api/editor { generatedContentId }` fires once. The backend calls `buildInitialTimeline()` to snapshot the content's assets into `edit_projects.tracks`. After that, the two records are linked by a foreign key but **never communicate again**.

- If you go back to `/generate` and iterate the hook → the editor doesn't know.
- If you change the voiceover script → the audio track in the editor is still the old file.
- If you add a scene → the editor timeline doesn't update.

The editor project is essentially a **stale fork** the moment it's created.

**Root cause:**

`buildInitialTimeline()` is a one-time constructor. There is no mechanism to re-sync the timeline when the source `generated_content` record changes. The denormalized columns on `edit_projects` (`generatedHook`, `postCaption`) are set at creation and never updated.

**What "universal sync" needs to mean:**

Every time a draft changes (via `iterate_content`, `edit_content_field`, or any tool), any editor project linked to that draft (or any ancestor in its version chain) should be notified — or at minimum, invalidated — so it can re-derive its state.

---

### Bug 2: Active Draft Resets on Every Reload

**What happens now:**

`activeContentId` lives in React state inside `useChatLayout`:

```typescript
// useChatLayout.ts:45
const [activeContentId, setActiveContentId] = useState<number | null>(null);
```

On session load/switch, it resets to `null`. A fallback in `ContentWorkspace` then auto-activates the **last draft** (most recently created chain tip):

```typescript
// ContentWorkspace.tsx:77-81
if (!activeContentId && drafts.length > 0) {
  onActiveContentChange(drafts[drafts.length - 1].id);
}
```

This means: if you have 3 drafts in a session — a full video, a caption-only piece, and a short hook — and you were working on the caption-only piece, after a reload the **short hook** is now active because it was generated last.

The AI then proceeds to iterate the wrong draft.

**There is no backend storage for "which draft is active in this session."** It's never written to the DB.

---

### Bug 3: One Assistant Message Can't Reference Multiple Drafts

**The model is clear:** one `generated_content` record = one draft, always. That's not the problem.

**The problem:** a single AI assistant message turn should be able to produce *multiple* `generated_content` records — for example, when the user asks for two hook variations, or a hook and a caption written separately. Each variation is its own `generated_content` row. But the current schema can only track one of them per message.

`chat_messages.generatedContentId` is a single `integer` column. If the AI calls `save_content` or `iterate_content` more than once in a single response turn, a mutable `savedContentId` variable in `send-message.stream.ts` is overwritten each time:

```typescript
// send-message.stream.ts:89-100
let savedContentId: number | null = null;
const toolContext: ToolContext = {
  get savedContentId() { return savedContentId || undefined; },
  set savedContentId(value) { savedContentId = value || null; } // ← overwrites on every tool call
};
```

Only the **last** content ID gets written to `chat_messages`. Any earlier `generated_content` records created in the same turn exist in the DB but are unreachable — `findChainTipDraftsForSession()` traces content IDs through `chat_messages.generatedContentId`, so anything not linked there never appears in the drafts panel.

**Practical scenario:**

User says "write me two different hook variations." AI calls `save_content` twice — draft A (id=10) and draft B (id=11). `savedContentId` ends as 11. Only draft B (id=11) is linked to the message. Draft A is orphaned and invisible to the user.

Even if the AI is currently constrained to one tool call per turn by the system prompt, the schema is a hard ceiling on the capability.

---

### Bug 4: The AI Corrects Its Own Conversation History

This is the most subtle and most damaging bug.

**What happens now:**

The AI gets `activeContentId` as part of the context injected before the user's message:

```
Active Draft (ID: 42, v2, status: ready):
Hook: "Why your morning routine is killing your gains"
...
For targeted field edits, call edit_content_field with contentId: 42.
For full rewrites, call iterate_content with parentContentId: 42.
```

But `activeContentId` is set to the **latest draft** on reload, not the one that was actually active in the conversation.

**Example failure:**

1. Session has 2 drafts: id=10 (fitness hook) and id=22 (nutrition hook).
2. User was working on id=10. User closes tab.
3. User reopens — id=22 auto-activates (it was created last).
4. User says "change the hook to be more aggressive."
5. AI context says active draft is id=22, so it calls `iterate_content(parentContentId: 22)`.
6. But the conversation history shows previous messages discussing the fitness hook from id=10.
7. The AI's new response contradicts the conversation history. The user is confused.

This isn't just a UX annoyance — it destroys the coherence of the AI conversation thread. The AI appears to "forget" what it was doing.

---

### Bug 5: Draft Invalidation Race Condition (Low Severity, Real)

When the AI finishes generating content:
1. The SSE stream emits `tool-output-available { contentId: X }`.
2. Frontend immediately fires `invalidateSessionDrafts()`.
3. The refetch hits `GET /api/chat/sessions/:id/content`.
4. If the DB write from the tool handler hasn't fully committed yet, the new draft doesn't appear.

The user sees no new draft, the loading spinner ends, and nothing changes. They have to manually refresh or wait for a retry.

No retry or polling logic exists for this case.

---

## Part 2: How the Chat Message System Handles Multiple Drafts Today

Short answer: **it doesn't, by design, but the design is wrong.**

The `findChainTipDraftsForSession()` query is smart about version chains — it only shows you the latest version of each generated content "lineage." But it can only find content records that are **reachable** from `chat_messages.generatedContentId`.

Since that column is a scalar, one message = one draft. A session with 10 AI turns can have at most 10 distinct draft lineages. In practice it's fewer because iterate/edit calls build on the same lineage rather than starting new ones.

**The active draft panel (ContentWorkspace) works reasonably well for single-draft sessions.** The two-step "click to preview, click Set Active to activate" is clunky but functional. The real problem is that `activeContentId` has no persistence layer — it's purely in-memory, which breaks everything the moment the page reloads.

---

## Part 3: Proposed Solution

### Principle

> The chat session is the source of truth for which draft is active. The editor is a materialized view of a draft. Both should reflect live state.

### Change 1: Persist `activeContentId` on the Session

**Problem solved:** Bugs 2, 4.

Add `activeContentId` to the `chat_sessions` table:

```sql
ALTER TABLE chat_sessions ADD COLUMN active_content_id INTEGER REFERENCES generated_content(id) ON DELETE SET NULL;
```

When the user changes the active draft (clicks "Set Active"), fire a `PATCH /api/chat/sessions/:id` with `{ activeContentId }`. This is a cheap, low-frequency write.

On session load, the backend returns `activeContentId` as part of the session object. The frontend initializes `activeContentId` state from this value instead of `null`. The auto-activate-latest fallback in `ContentWorkspace` only fires if `session.activeContentId` is null.

**Result:** Active draft survives page reload. The AI always gets the correct anchor. Conversation history remains coherent.

---

### Change 2: Replace Scalar `generatedContentId` with a Junction Table

**Problem solved:** Bug 3.

One `generated_content` = one draft. The fix is purely about allowing one assistant message to point to *multiple* `generated_content` rows — replacing the scalar column with a junction table:

```sql
CREATE TABLE chat_message_drafts (
  id            SERIAL PRIMARY KEY,
  message_id    UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  content_id    INTEGER NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
  slot          SMALLINT NOT NULL DEFAULT 0,  -- ordering within the message
  UNIQUE (message_id, content_id)
);
```

The `findChainTipDraftsForSession()` query joins through `chat_message_drafts` instead of `chat_messages.generatedContentId`.

On the frontend, the SSE `tool-output-available` event can fire multiple times per stream turn (once per content tool call). Each fires `setStreamingContentId()` — the workspace just needs to handle receiving multiple IDs across a single stream rather than replacing.

**Result:** A single AI turn can legitimately produce multiple `generated_content` records (one per draft), each properly linked to the originating message. The orphan problem goes away.

---

### Change 3: Replace `buildInitialTimeline` + `mergeNewAssetsIntoProject` with `SyncService`

**Problem solved:** Bug 1.

#### What gets deleted

Two files are fully deleted — no refactoring, no reuse:

- `backend/src/domain/editor/build-initial-timeline.ts` — builds a fresh timeline from scratch on project creation. One-shot, not designed for re-sync.
- `backend/src/domain/editor/merge-new-assets.ts` — patches new assets into an existing timeline using a `mergedAssetIds` set to track what's been seen. Incremental and stateful in the wrong way — it tracks _assets_ rather than deriving from _content state_.

These two functions have different shapes, different assumptions, and duplicate clip-construction logic. They are not worth adapting. The design they represent — initial build vs incremental patch — is wrong for a world where sync is automatic and continuous.

Also remove `mergedAssetIds` from `edit_projects`. It's only used by `mergeNewAssetsIntoProject` and becomes meaningless once that file is gone.

#### What replaces them: `SyncService`

A single class, `backend/src/domain/editor/sync/sync.service.ts`, owns all timeline derivation from content. It has two public methods:

```typescript
class SyncService {
  constructor(
    private readonly editor: IEditorRepository,
    private readonly content: IContentRepository,
    private readonly captionsService: CaptionsService,
  ) {}

  // Called on editor project creation.
  // Returns the initial tracks and durationMs for a brand-new project.
  async deriveTimeline(
    userId: string,
    contentId: number,
  ): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }>

  // Called automatically after every content tool call (save_content, iterate_content, edit_content_field).
  // Finds all editor projects in the content's ancestor chain and re-syncs each one.
  async syncLinkedProjects(
    userId: string,
    contentId: number,
  ): Promise<void>
}
```

#### How `deriveTimeline` works

This replaces the "initial build" concern. It is **stateless** — it takes content assets and produces tracks from scratch every time. No concept of "what was already merged."

1. Fetch all assets linked to `contentId` from `content_assets`.
2. Partition by role: `video_clip[]`, `voiceover?`, `background_music?`.
3. Sort video clips by `metadata.shotIndex`.
4. Build four tracks (video, audio, music, text) with every clip tagged `source: "content"`.
5. Trigger caption transcription for voiceover if present.
6. Compute `durationMs` from the clip extents.
7. Return `{ tracks, durationMs }`.

Called from `EditorService.createEditorProject()` — the call site in `editor.service.ts` changes from `buildInitialTimeline(...)` to `this.syncService.deriveTimeline(userId, contentId)`.

#### How `syncLinkedProjects` works

This replaces the "incremental merge" concern and makes it automatic.

#### Why it can't be HTTP route middleware

The obvious instinct is to make `SyncService` a Hono middleware attached to routes that talk to `/generate` and `/editor`. This won't work.

The streaming route (`POST /api/chat/sessions/:id/messages`) is a single long-lived HTTP request. Content gets saved inside the AI SDK's `tool.execute` callback, which fires mid-stream. By the time an HTTP middleware's "after" hook would run, the stream is already closed and `tool-output-available` has already reached the frontend. Attaching sync at the route boundary is too late — the frontend would invalidate the editor cache before the sync ran.

#### The right level: `ToolContext` callback

`ToolContext` (defined in `chat-tools.ts`) is the object threaded through every tool's `execute` function. It already holds `auth` and `savedContentId`. Add an `onContentSaved` callback to it:

```typescript
// chat-tools.ts
export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  content: string;
  reelRefs?: number[];
  savedContentId?: number;
  onContentSaved?: (contentId: number) => Promise<void>; // ← new
}
```

In `send-message.stream.ts`, set it when building `toolContext`:

```typescript
const toolContext: ToolContext = {
  auth,
  content,
  reelRefs,
  get savedContentId() { return savedContentId || undefined; },
  set savedContentId(value) { savedContentId = value || null; },
  onContentSaved: (contentId) => syncService.syncLinkedProjects(auth.user.id, contentId),
};
```

Each content tool calls `await context.onContentSaved?.(row.id)` immediately after saving:

```typescript
// inside save_content execute:
const row = await chatToolsRepository.saveNewDraftContentWithQueueItem({ ... });
context.savedContentId = row.id;
await context.onContentSaved?.(row.id); // ← sync fires here, before SSE event
return { success: true, contentId: row.id };
```

This is effectively a decorator at the tool level — sync is a concern injected into tools from outside, not hardcoded in each one. Adding a new content tool in the future just requires calling `onContentSaved` after the save; the sync wiring is in one place (`send-message.stream.ts`).

```
save_content / iterate_content / edit_content_field execute():
  → content saved to DB (contentId = 55, parentId = 42)
  → context.onContentSaved(55)
    → syncService.syncLinkedProjects(userId, 55)
      → resolveAncestorChain(55) → [55, 42]
      → findProjectsInContentChain(userId, [55, 42]) → [{ id: "proj-abc", ... }]
      → for each project:
          freshTracks = deriveTimeline(userId, 55)
          userTracks  = extractUserClips(project.tracks)
          merged      = mergeTrackSets(freshTracks, userTracks)
          UPDATE edit_projects SET tracks = merged, generatedContentId = 55, version = version + 1
  → tool returns { success: true, contentId: 55 }
  → SSE emits tool-output-available { contentId: 55 }  ← editor is already updated
```

The sync completes before `tool-output-available` fires. By the time the frontend invalidates the editor cache, the DB already has the updated project.

#### The `source` field on clips

Every clip in `TimelineTrackJson` gets a `source` field:

```typescript
type TimelineClipJson = {
  // ... existing fields
  source: "content" | "user";
}
```

`deriveTimeline()` always produces `source: "content"` clips. When a user manually adds a clip (B-roll, custom audio), the frontend sets `source: "user"` on it before autosaving.

`syncLinkedProjects` preserves `source: "user"` clips across syncs:

```typescript
function mergeTrackSets(
  freshTracks: TimelineTrackJson[],   // all source: "content"
  existingTracks: TimelineTrackJson[], // mix of "content" and "user"
): TimelineTrackJson[] {
  return freshTracks.map((freshTrack) => {
    const existing = existingTracks.find((t) => t.type === freshTrack.type);
    const userClips = existing?.clips.filter((c) => c.source === "user") ?? [];
    return { ...freshTrack, clips: [...freshTrack.clips, ...userClips] };
  });
}
```

Content-derived clips (AI shots, voiceover, music) are fully replaced. User clips survive untouched.

#### Conflict detection

A conflict arises when the editor project has been autosaved by the user (i.e., `userHasEdited = true`) and a sync is about to overwrite `source: "content"` clips that the user may have manually trimmed or repositioned.

The sync still runs automatically — the user's trim/position edits on content clips are the only thing at risk. The rule:

- If a content clip's `assetId` matches an existing `source: "content"` clip in the project, **carry forward the existing clip's `trimStartMs`, `trimEndMs`, `positionX`, `positionY`, `scale`, `rotation`** from the old clip into the new one. The `assetId` updates (pointing to the latest asset), but the user's manual adjustments are preserved.
- If the asset is brand new (no prior clip with that `assetId`), insert it at default values.

This is conservative — user trim work on content clips is never discarded.

#### Frontend: Invalidate editor cache on draft change

Extend `use-streaming-content-side-effects.ts` to invalidate the editor cache when a content tool completes:

```typescript
if (streamingContentId) {
  void invalidateSessionDrafts(queryClient, sessionId);
  void invalidateEditorProjectsQueries(queryClient); // ← add
}
```

`refetchOnWindowFocus` handles the case where the editor is open in a background tab.

**Result:** Editor is always in sync with the latest draft. Zero user intervention. User trim/position edits on content clips are preserved. User-added clips are never touched.

---

### Change 4: Fix the Invalidation Race with Optimistic Insertion

**Problem solved:** Bug 5.

When `streamingContentId` fires, instead of immediately invalidating (and hoping the DB is ready), **optimistically insert** the new draft into the TanStack Query cache using the data already present in `streamingContent`:

```typescript
// In use-streaming-content-side-effects.ts
if (streamingContentId && streamingContent) {
  queryClient.setQueryData(
    queryKeys.api.sessionDrafts(sessionId),
    (old) => ({
      drafts: [
        ...(old?.drafts ?? []),
        {
          id: streamingContentId,
          status: "ready",
          generatedHook: extractHookFromStream(streamingContent),
          // ... other fields from accumulated stream text
        }
      ]
    })
  );
}
// Then invalidate in the background to get the authoritative DB record
void invalidateSessionDrafts(queryClient, sessionId);
```

The draft appears immediately (from optimistic data) and gets replaced by the real DB record once the refetch resolves.

---

### Change 5: Rethink the Active Draft UX

The current two-step UX (click preview, click Set Active) is opaque. Users don't understand why they have to explicitly "set" active — they expect clicking a draft to make it the working context.

**Proposed:**

- Clicking a draft in DraftsList both previews it AND sets it as active. No separate "Set Active" button.
- The active draft is visually distinguished (highlighted border, label "Active").
- A small indicator in the chat input shows "Working on: [hook text]" — gives the user confidence the AI knows what they're working on.
- On session open, the active draft (now persisted) is pre-selected and visually highlighted.

---

## Part 4: Data Model Summary After Changes

```
chat_sessions
  id
  activeContentId  INT | null    ← NEW: persisted active draft
  ...

chat_messages
  id
  sessionId
  role
  content
  -- generatedContentId REMOVED

chat_message_drafts              ← NEW TABLE
  id
  messageId        UUID → chat_messages.id
  contentId        INT  → generated_content.id
  slot             SMALLINT

generated_content
  id
  parentId
  status
  ...

edit_projects
  id
  generatedContentId  INT | null
  -- mergedAssetIds REMOVED (was only used by merge-new-assets.ts, deleted)
  ...

clips (within tracks JSONB or extracted)
  source  "content" | "user"    ← NEW field on Clip type
```

---

## Part 5: Implementation Order

These changes have dependencies. The right order:

1. **Persist `activeContentId` on session** (Change 1) — pure backend + small frontend change. No schema risk. Fixes the most damaging bug (conversation coherence) immediately.

2. **Fix invalidation race** (Change 4) — isolated frontend change. Low risk, immediate UX improvement.

3. **Rethink active draft UX** (Change 5) — frontend-only. Depends on Change 1 being done first so the active state is reliable.

4. **Replace scalar with junction table** (Change 2) — requires DB migration, backend query updates, frontend SSE handling update. Medium risk. Do after 1 and 4 are stable.

5. **`SyncService`** (Change 3) — delete `build-initial-timeline.ts` and `merge-new-assets.ts`, write `sync/sync.service.ts` with `deriveTimeline` + `syncLinkedProjects`, add `source` field to `TimelineClipJson`, wire tool handlers to call `syncLinkedProjects`, add editor cache invalidation on stream complete. Most complex. Do last.

---

## Part 6: Data Model Clarification

To be explicit about the 1:1 relationship that must never change:

```
generated_content (id=10)  ←→  one draft ("Why your morning routine...")
generated_content (id=11)  ←→  one draft ("The fitness myth nobody talks about")
generated_content (id=12)  ←→  one draft (iterate of id=10, parentId=10)
```

A `generated_content` record never represents more than one draft. The multi-draft problem is purely at the **message** level — one assistant turn in the chat UI should be able to reference multiple of these records simultaneously, which is what the junction table enables.

---

## Part 7: What NOT to Do

- **Do not add a manual "Re-sync" banner or button.** The sync must be automatic — every content tool call triggers an immediate rebuild of any linked editor project before the SSE event reaches the frontend. By the time the user sees "draft updated," the editor is already current.
- **Do not use websockets or polling for editor sync.** The tool call itself is the sync trigger. The rebuild happens synchronously in the same request, and TanStack Query invalidation handles the frontend refresh. No push infrastructure needed.
- **Do not auto-activate the latest draft on session load.** This is the source of Bug 4. The fallback should only trigger if the session has never had an active draft set (i.e., first-ever load of a new session).
- **Do not try to preserve full conversation history coherence by storing draft snapshots inline.** The version chain in `generated_content.parentId` already solves this — tools correctly pass `parentContentId` when iterating. The only missing piece is that the frontend doesn't reliably tell the backend which draft to use as the parent.
