# Content Workspace

**Status:** Ready to implement (3 phases)
**Informed by:** Deep code research + PM review
**Supersedes:** The `DraftPicker` dropdown approach (which solved the wrong problem)

---

## The Real Problem

When the AI generates content it calls `save_content` or `iterate_content`, which saves a structured record to the DB with:
- `generatedHook` — the viral opening line
- `generatedScript` — scene-by-scene shot list with timing
- `generatedCaption` — full caption with emojis
- `generatedMetadata` — `{ hashtags[], cta, contentType, changeDescription? }`
- `version` + `parentId` — versioning chain

**None of this is visible to the user.** They see only the AI's prose response. The structured data exists only in the database.

Additionally, `iterate_content` requires a `parentContentId`, but when multiple content chains exist in a session, **the AI has no reliable way to know which content the user means.** This is both a user visibility problem and an AI context problem.

---

## Mental Model: "Drafts"

Call generated content pieces **Drafts**. Not "reels" (no video yet), not "projects" (taken). Each Draft is a distinct content idea at its latest version. Matches the DB `status: "draft"` field and existing `DraftPicker` naming.

---

## Architecture Decision

**The right panel becomes a unified `ContentWorkspace` panel with two tabs:**

```
┌──────────────────────────────────────────┐
│  [Drafts]  [Audio]                  [✕]  │  ← tabs
├──────────────────────────────────────────┤
│  Drafts list / selected draft detail     │
│  OR                                      │
│  AudioPanel (voiceover + music)          │
└──────────────────────────────────────────┘
```

`AudioPanel` currently has exclusive claim on the right sidebar. It becomes the **Audio tab** within the workspace. The new **Drafts tab** is the primary view.

This is the correct location because:
- Persistent visibility without stealing from chat
- The sidebar pattern already exists (`AudioPanel` is already 380px right panel)
- Can show structured content when a draft is selected
- Doesn't interrupt chat flow

---

## Phase 1: Content Workspace Panel

### New backend endpoint

`GET /api/chat/sessions/:id/content` — returns all generated content for a session, grouped by chain tip.

```typescript
// Returns only the tip (latest version) of each chain
// Chain: id=101(v1) → 104(v2) → 107(v3) → returns id=107 with version=3
{
  drafts: Array<{
    id: number
    version: number
    outputType: string
    status: string
    generatedHook: string | null
    generatedScript: string | null
    generatedCaption: string | null
    generatedMetadata: { hashtags: string[], cta: string, contentType: string } | null
    createdAt: string
    // Derived: label from hook (first 30 chars) or fallback
  }>
}
```

**Query logic:** Use a `WITH RECURSIVE` CTE or a simpler approach — select all `generatedContent` rows that are linked to this session via `chatMessages.generatedContentId`, then filter to only the ones with no children (i.e., where `id` does not appear as any row's `parentId`). These are the chain tips.

Alternatively (simpler): for each unique root chain, follow `parentId` links to find the latest. Since sessions are short, a subquery approach is fine:

```sql
SELECT gc.* FROM generated_content gc
JOIN chat_messages cm ON cm.generated_content_id = gc.id
WHERE cm.session_id = :sessionId
  AND cm.role = 'assistant'
  AND NOT EXISTS (
    SELECT 1 FROM generated_content child
    WHERE child.parent_id = gc.id
  )
ORDER BY gc.created_at ASC
```

### Frontend: `ContentWorkspace` component

Replaces the `audioContext !== null` conditional that currently shows `AudioPanel` as a floating panel.

```
ContentWorkspace (380px right panel, always visible when session is open)
├── Header: [Drafts] [Audio] tabs + close button
├── Drafts tab:
│   ├── Draft list (when no draft selected)
│   │   └── DraftCard × N (hook label, version badge, outputType, audio status)
│   └── Draft detail (when a draft is selected)
│       ├── Back button
│       ├── Active indicator + "Set as active" button
│       ├── HOOK section
│       ├── SCRIPT section (collapsible if long)
│       ├── CAPTION section
│       ├── HASHTAGS section
│       ├── CTA section
│       └── Actions: [Send to Queue] [Add Audio →]
└── Audio tab:
    └── Current AudioPanel content (VoiceoverGenerator/Player, MusicAttachment, etc.)
```

### Draft card design

```
┌─────────────────────────────────────────────┐
│  ● ACTIVE                                   │  ← only on active draft
│  "You're wasting the first hour of every…"  │  ← from generatedHook
│  v3  ·  Full Script  ·  🎙 VO  🎵 Music     │  ← version, outputType, audio assets
└─────────────────────────────────────────────┘
```

- Clicking a card opens the draft detail view
- The active draft has a distinct left border or dot indicator
- Version badge is small — an indicator, not navigation
- Audio asset indicators reuse `useContentAssets` (already cached from chat messages)

### Draft detail view (read-only in MVP)

```
← Back to Drafts

● ACTIVE DRAFT
Hook about morning routines  (v3)

─── HOOK ────────────────────────────────────
"You're wasting the first hour of every morning and here's proof"

─── SCRIPT ──────────────────────────────────
[0-3s] Opening hook — text overlay on screen
[3-8s] Problem setup...
[8-20s] Value delivery...
[27-30s] CTA

─── CAPTION ─────────────────────────────────
Start your morning right 🌅...

─── HASHTAGS ────────────────────────────────
#morningroutine #productivity #lifehacks

─── CTA ─────────────────────────────────────
"Save this for tomorrow morning"

[Send to Queue]  [Add Audio →]
```

**Read-only in MVP.** Inline editing creates a competing editing path that conflicts with the chat-first product thesis. If users want to change the hook, they ask the AI in chat. The one exception (already built): the AudioPanel script textarea is editable for spoken delivery adjustments only.

`[Add Audio →]` switches to the Audio tab with this content loaded.

---

## Phase 2: Active Draft Context (AI Awareness)

### The problem it solves

When a user says "make the hook shorter" and has 3 drafts, the AI currently guesses. The active draft selection makes this deterministic.

### Frontend changes

1. `activeContentId: number | null` state in `ChatLayout` (or a context)
2. Auto-set to new content when `streamingContentId` becomes non-null (the last generated/iterated content is always active by default)
3. User can manually select any draft as active from the workspace
4. Active draft state is **session-scoped** — cleared on session switch

### Wire active draft into send-message

```typescript
// ChatLayout.tsx handleSendMessage
await sendMessage(content, reelRefs, activeContentId ?? undefined);

// use-chat-stream.ts sendMessage signature
sendMessage(content: string, reelRefs?: number[], activeContentId?: number)

// POST /api/chat/sessions/:id/messages body
{
  content: string,
  reelRefs?: number[],
  activeContentId?: number  // NEW
}
```

### Backend: inject active draft into AI context

`buildChatContext()` in `backend/src/routes/chat/index.ts`:

```typescript
async function buildChatContext(userId, project, reelRefs, activeContentId?) {
  let context = `Project: ${project.name}`;

  if (activeContentId) {
    const [active] = await db.select().from(generatedContent)
      .where(and(
        eq(generatedContent.id, activeContentId),
        eq(generatedContent.userId, userId)
      ));
    if (active) {
      context += `\n\nActive Draft (ID: ${active.id}, v${active.version}):
Hook: "${active.generatedHook ?? 'none'}"
Script: "${active.generatedScript?.slice(0, 200) ?? 'none'}..."
Caption: "${active.generatedCaption?.slice(0, 100) ?? 'none'}..."
Type: ${active.outputType}

When the user asks to edit or refine content, use iterate_content with parentContentId: ${active.id}.`;
    }
  }

  // ...existing reel context...
}
```

### System prompt addition

Add to `backend/src/prompts/chat-generate.txt`:
```
When an "Active Draft" is listed in context, that is the content the user is currently working on.
For any edit/revision requests ("make the hook shorter", "change the CTA", "rewrite this"),
call iterate_content with the active draft's ID unless the user explicitly specifies a different one.
```

---

## Phase 3: Real-Time Workspace Updates

When content is generated mid-chat, the workspace should update without any user action.

### Signal: `streamingContentId`

Already available in `ChatLayout` via `useChatStream`. When this becomes non-null:
1. **New draft** (from `save_content`): add to workspace draft list with entry animation, auto-select as active
2. **Iteration** (from `iterate_content`): update the existing card's version badge, auto-set as active

### How to distinguish new vs iteration

The `streamingContentId` alone doesn't tell us which case we're in. Options:
- Fetch the record via `GET /api/generation/:streamingContentId` — if `parentId` is null it's a new draft, if not it's an iteration
- Or: add a `isIteration` flag to the SSE stream event from the backend (simpler)

Simplest: just fetch the content record and check `parentId`. React Query will cache it immediately.

### Entry animation

New draft cards animate in with a subtle fade-up. Version badge bumps with a brief scale pulse. Keep it fast (150ms) — this is informational feedback, not a celebration.

---

## What NOT to Build

| Deferred | Reason |
|---|---|
| Version history browser (v1 → v2 → v3 diff view) | User can re-read chat. Post-MVP. |
| Inline editing of draft fields | Competes with chat-first thesis. Creates dual source of truth. |
| Draft renaming | Auto-label from hook is sufficient for MVP. |
| Cross-session draft view | Out of scope — workspace is session-scoped. |
| Copy-to-clipboard per field | Easy fast-follow, not MVP-blocking. |
| Draft comparison side-by-side | Power-user feature, premature. |

The `DraftPicker` dropdown in the session header should be **removed** once ContentWorkspace is live — the workspace replaces its function entirely and does it better.

---

## Files to Create/Change

### New files
| File | Purpose |
|---|---|
| `frontend/src/features/chat/components/ContentWorkspace.tsx` | Root panel: tab switcher, renders DraftsList or AudioPanel |
| `frontend/src/features/chat/components/DraftsList.tsx` | List of draft cards from session |
| `frontend/src/features/chat/components/DraftDetail.tsx` | Full structured view: hook/script/caption/hashtags/CTA |
| `frontend/src/features/chat/hooks/use-session-content.ts` | React Query hook: `GET /api/chat/sessions/:id/content` |

### Modified files
| File | Change |
|---|---|
| `backend/src/routes/chat/index.ts` | Add `GET .../content` endpoint; update `sendMessageSchema` + `buildChatContext` to accept `activeContentId` |
| `backend/src/prompts/chat-generate.txt` | Add active draft instruction |
| `frontend/src/features/chat/components/ChatLayout.tsx` | Replace AudioPanel + DraftPicker with ContentWorkspace; thread `activeContentId` through send-message |
| `frontend/src/features/chat/hooks/use-chat-stream.ts` | Pass `activeContentId` in send-message fetch |
| `frontend/src/features/chat/services/chat.service.ts` | Update `sendMessage` to accept `activeContentId` |
| `frontend/src/features/chat/types/chat.types.ts` | Add `activeContentId?: number` to `SendMessageRequest` |
| `frontend/src/features/chat/components/DraftPicker.tsx` | **Delete** once workspace is live |

---

## Success Criteria

1. A user who generates 3 content pieces in one session sees all 3 in the workspace without scrolling chat
2. A user who says "make the hook shorter" after selecting a draft gets the correct draft iterated
3. A user can read the structured hook/script/caption of any draft without re-reading AI prose
4. "Send to Queue" lives on the draft detail — users know exactly what they're sending
5. New drafts appear in the workspace automatically as the AI generates them
