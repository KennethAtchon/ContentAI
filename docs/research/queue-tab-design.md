# Queue Tab Redesign

The Queue tab as a content management hub: view, delete, edit, and schedule generated reels.

**Date:** 2026-03-12
**Status:** Research
**Related:** `frontend/src/routes/studio/queue.tsx`, `backend/src/routes/queue/index.ts`

---

## Current State

The existing Queue tab is minimal:
- Lists `queueItems` with status filters (all/scheduled/posted/failed)
- Shows: ID, scheduled date, Instagram page ID, error message
- Can delete items (if not posted)
- Can update `scheduledFor` and `instagramPageId`

**What's missing:**
- No visual preview of the generated content
- No way to edit content from the queue
- No connection to the new project/chat system
- No video preview or playback
- No bulk operations

---

## Redesigned Queue Tab

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  StudioTopBar  [Discover]  [Generate]  [Queue*]          │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│  Filters     │  Content Grid / List                      │
│              │                                           │
│  Status:     │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  ○ All (12)  │  │ 📹      │ │ 📹      │ │ 📹      │    │
│  ○ Draft (5) │  │ Hook... │ │ Hook... │ │ Hook... │    │
│  ○ Ready (3) │  │ Fitness │ │ Tech    │ │ Food    │    │
│  ○ Sched.(2) │  │ v2 ✎   │ │ v1 ✎   │ │ v3 ✎   │    │
│  ○ Posted (1)│  └─────────┘ └─────────┘ └─────────┘    │
│  ○ Failed (1)│                                           │
│              │  ┌─────────┐ ┌─────────┐                  │
│  Sort:       │  │ 📹      │ │ 📹      │                  │
│  [Newest ▾]  │  │ Hook... │ │ Hook... │                  │
│              │  │ Cooking │ │ Travel  │                  │
│  Project:    │  │ v1 ✎   │ │ v1 ✎   │                  │
│  [All ▾]     │  └─────────┘ └─────────┘                  │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### Content Card

Each queue item shows:
- Video thumbnail (from `generatedContent.thumbnailR2Key` or first frame)
- Hook text (truncated)
- Project name + niche label
- Version indicator (v1, v2, v3)
- Status badge (Draft / Ready / Scheduled / Posted / Failed)
- Edit button → navigates to project in Generate tab
- Delete button (with confirmation)
- Schedule button (date picker)

### Status Flow

```
Draft → Ready → Scheduled → Posted
                    ↓
                  Failed → (retry) → Scheduled
```

- **Draft:** Generated content exists but not finalized (no video assembled yet, or user hasn't approved)
- **Ready:** Content is finalized (video assembled, user approved) — waiting to be scheduled
- **Scheduled:** Has a `scheduledFor` date — will be posted automatically (future: Instagram API)
- **Posted:** Successfully published
- **Failed:** Publish attempt failed (error message shown)

### Edit Flow

**Case 1: Project exists**
Edit button navigates to: `/studio/generate?project={projectId}&session={sessionId}`
The user lands in the chat where the content was generated and can iterate further.

**Case 2: Project was deleted**
The content's `chatSession.projectId` references a deleted project. Two options:

**Option A: Prevent project deletion when queue items exist**
- When user tries to delete a project, check if any `generatedContent` linked to its sessions has active queue items
- Show warning: "This project has N items in your queue. Delete them first or move them to another project."

**Option B: "Edit existing video" standalone flow**
- The edit button opens a lightweight editor (not the full chat) where the user can:
  - Edit the hook, caption, hashtags directly (text fields)
  - Re-record/regenerate voiceover
  - Open the visual editor for video tweaks
- No project/chat context needed — it operates on the `generatedContent` record directly

**Recommendation:** Option A for now (simpler, prevents orphaning), with Option B as a future enhancement for the editing suite.

### Bulk Operations

- **Select multiple** → Delete, Move to project, Set status
- **Select all filtered** → Same operations on current filter results

---

## API Changes

### Modified Endpoints

**`GET /api/queue`** — add response fields:
```json
{
  "items": [
    {
      "id": 1,
      "status": "draft",
      "scheduledFor": null,
      "generatedContent": {
        "id": 5,
        "hook": "Stop scrolling if...",
        "caption": "Full caption...",
        "version": 2,
        "thumbnailR2Key": "thumbnails/...",
        "videoR2Key": "video/generated/..."
      },
      "project": {
        "id": 3,
        "name": "Fitness Brand",
        "isDeleted": false
      },
      "chatSessionId": 12,
      "createdAt": "..."
    }
  ],
  "total": 12
}
```

Add query params:
- `projectId` — filter by project
- `sort` — `newest` (default), `oldest`, `scheduled`

**`PATCH /api/queue/:id`** — add `status` field to allow status transitions:
```json
{ "status": "ready" }  // mark as finalized
{ "status": "scheduled", "scheduledFor": "2026-03-15T10:00:00Z" }
```

Validate transitions: only allow valid state changes (Draft→Ready, Ready→Scheduled, etc.)

### New Endpoints

```
DELETE /api/queue/bulk     — { ids: number[] } — bulk delete
PATCH  /api/queue/bulk     — { ids: number[], status: string } — bulk status update
```

---

## Database Changes

### Modified Tables

**`queueItems`** — add:
```
status         text    -- expand from current values to: draft, ready, scheduled, posted, failed
```
(Current status values are already similar, verify exact values match)

**`generatedContent`** — add:
```
version        integer DEFAULT 1
parentId       integer          -- self-ref FK for version chain
thumbnailR2Key text             -- generated thumbnail
videoR2Key     text             -- assembled video (distinct from source reel videoR2Key)
```

### Soft Delete for Projects

Add `isDeleted boolean DEFAULT false` to `projects` table (from `generate-tab-ai-chat-interface.md`). Queue items can reference the project name even after deletion. Filter deleted projects from the project list but keep the data.

---

## Frontend Components

```
src/features/queue/
├── components/
│   ├── QueueGrid.tsx           — grid/list view of queue items
│   ├── QueueCard.tsx           — individual content card
│   ├── QueueFilters.tsx        — status + project + sort filters
│   ├── QueueBulkActions.tsx    — bulk operation bar
│   ├── ScheduleDialog.tsx      — date/time picker for scheduling
│   └── StatusBadge.tsx         — colored status indicator
├── hooks/
│   ├── use-queue.ts            — existing hook, enhanced
│   └── use-queue-mutations.ts  — delete, update status, bulk ops
└── types/
    └── queue.types.ts          — enhanced QueueItem type
```

---

## Implementation Priority

```
P0 (MVP):
  - Enhanced queue card with content preview (hook, thumbnail)
  - Edit button → navigate to Generate tab project/session
  - Status filter (existing, just improve UI)
  - Delete with confirmation

P1:
  - Project filter
  - Status transitions (Draft → Ready → Scheduled)
  - Schedule date picker
  - Bulk delete

P2:
  - Video preview/playback in card
  - Bulk status update
  - Version history view
  - "Edit existing video" standalone flow
```
