# Queue Management Journey

**Route:** `/studio/queue`
**Auth:** Required (`authType="user"`)

---

## Overview

The Queue is the content production pipeline. Content generated in the AI chat moves through a series of stages before it is posted to social media.

**Layout:** Filter bar at top, queue item list on the left, detail panel on the right.

---

## Pipeline Stages

Each queue item progresses through these stages (tracked via asset counts):

```
Copy → Voiceover → Video Clips → Assembly → Manual Edit → Export
```

Progress through stages is derived from the assets attached to the content item — it is not a separate state machine column; the backend computes stage completion from the `content_assets` table.

---

## Queue Item Statuses

| Status | Meaning | Valid Transitions |
|---|---|---|
| `draft` | Work in progress | → `ready`, `scheduled` |
| `ready` | Content finalized, ready to post | → `draft`, `scheduled` |
| `scheduled` | Has a future post date/time set | → `ready`, `posted` |
| `posted` | Published (terminal state) | — |
| `failed` | Something went wrong | → `draft` (retry) |

Status transitions are validated server-side. Invalid transitions return a `400` error.

---

## Journey: Browse the Queue

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Navigate to /studio/queue
    FE->>BE: GET /api/queue?limit=20
    BE->>DB: SELECT queue_items JOIN generated_content JOIN projects WHERE user_id=:uid
    DB-->>BE: Queue items page 1
    BE-->>FE: [{ id, hook, status, projectName, version, pipelineStages, scheduledFor }]
    FE->>FE: Render queue item cards list

    U->>FE: Click a queue item card
    FE->>FE: Open detail panel (right side)
    FE->>FE: Show: hook, caption, script, scene description, assets, action buttons
```

---

## Journey: Filter the Queue

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Select status filter: "ready"
    FE->>BE: GET /api/queue?status=ready&limit=20
    BE-->>FE: Filtered items

    U->>FE: Select project filter: "My Fitness Project"
    FE->>BE: GET /api/queue?status=ready&projectId=<id>&limit=20
    BE-->>FE: Further filtered items

    U->>FE: Type in search input (debounced 300ms)
    FE->>BE: GET /api/queue?search=<term>&limit=20
    BE-->>FE: Search results
```

---

## Journey: Update Queue Item Status

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Mark Ready" on a draft item
    FE->>BE: PATCH /api/queue/:id { status: "ready" }
    BE->>BE: Validate transition: draft → ready ✓
    BE->>DB: UPDATE queue_items SET status="ready" WHERE id=:id
    DB-->>BE: Updated item
    BE-->>FE: { id, status: "ready" }
    FE->>FE: Update status badge on card

    U->>FE: Click "Move back to Draft"
    FE->>BE: PATCH /api/queue/:id { status: "draft" }
    BE->>BE: Validate transition: ready → draft ✓
    BE->>DB: UPDATE queue_items SET status="draft"
    BE-->>FE: Updated item
```

---

## Journey: Schedule a Queue Item

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Open queue item detail panel
    U->>FE: Click date/time picker → Select a future datetime
    FE->>BE: PATCH /api/queue/:id { scheduledFor: "2026-03-25T14:00:00Z" }
    BE->>BE: Validate: date is in the future ✓
    BE->>BE: Validate transition: draft/ready → scheduled ✓
    BE->>DB: UPDATE queue_items SET status="scheduled", scheduled_for=...
    BE-->>FE: { id, status: "scheduled", scheduledFor }
    FE->>FE: Show scheduled timestamp on card
```

---

## Journey: Duplicate a Queue Item

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Duplicate" on a queue item
    FE->>BE: POST /api/queue/:id/duplicate
    BE->>DB: SELECT queue_item + generated_content (chain tip)
    BE->>DB: INSERT INTO generated_content { parentId: <tip_id>, version: N+1 } (clone)
    BE->>DB: INSERT INTO queue_items { content_id: <new_id>, status: "draft" }
    BE-->>FE: { newQueueItemId }
    FE->>FE: New item appears at top of queue list
    FE->>FE: Show "Duplicated" toast
```

---

## Journey: Delete a Queue Item

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Delete" on a queue item
    FE->>FE: Show confirmation dialog
    U->>FE: Confirm delete
    FE->>BE: DELETE /api/queue/:id
    BE->>DB: DELETE queue_items WHERE id=:id
    BE->>DB: UPDATE generated_content SET status="draft" (if only queued copy)
    BE-->>FE: { success: true }
    FE->>FE: Remove item from list
    FE->>FE: Close detail panel
```

---

## Journey: Open Queue Item in Editor or Chat

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend

    U->>FE: Click "Open in Editor" on queue item (if editor project exists)
    FE->>FE: Navigate to /studio/editor?contentId=<id>

    U->>FE: Click "Open in Chat" on queue item
    FE->>FE: Navigate to /studio/generate?sessionId=<session_id>
```

---

## Journey: Pagination

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Click "Next page"
    FE->>BE: GET /api/queue?limit=20&offset=20
    BE-->>FE: Page 2 of queue items
    FE->>FE: Replace list with page 2

    U->>FE: Click "Previous page"
    FE->>BE: GET /api/queue?limit=20&offset=0
    BE-->>FE: Page 1
    FE->>FE: Replace list with page 1
```

---

## Key Components

| Component | Purpose |
|---|---|
| `QueueList` | Left-side scrollable list of queue items |
| `QueueItemCard` | Individual card showing hook, status badge, pipeline stages |
| `QueueDetailPanel` | Right-side full detail view + action buttons |
| `PipelineStages` | Visual stage progress tracker (Copy → Export) |
| `StatusBadge` | Color-coded status indicator |
