# Editor Journey (Timeline Editor)

**Route:** `/studio/editor`
**Auth:** Required (`authType="user"`)
**Desktop only:** Requires viewport width ≥ 1280px. Smaller screens see a message instead of the editor.

---

## Overview

The Editor is a timeline-based video editing workspace for assembling final content. Editor projects link to generated content items and can be opened from the Queue.

**Layout (Project List View):** Grid of project cards.
**Layout (Editor View):** Full-screen timeline editor with tracks, clips, and playback controls.

---

## What the User Sees (Project List)

- Grid of editor project cards
- Each card shows: thumbnail placeholder, title (or generated hook text), version badge, "published" badge if applicable, date, duration
- "New Project" button in header
- Actions per card: "Open", "Open in AI Chat", "Delete"

---

## What the User Sees (Timeline Editor)

- Playhead for scrubbing through the timeline
- Track headers with track labels and controls
- Timeline clips draggable on tracks
- Waveform visualization for audio tracks
- Playback controls (play/pause/stop, current time display)

---

## Journey: Open the Editor (from /studio/editor)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Navigate to /studio/editor
    FE->>FE: Check window.innerWidth >= 1280
    alt Too narrow
        FE->>FE: Show "Please use a desktop browser" message
    else Desktop width
        FE->>BE: GET /api/editor
        BE->>DB: SELECT edit_projects WHERE user_id=:uid ORDER BY updated_at DESC
        DB-->>BE: Projects list
        BE-->>FE: [{ id, title, generatedContentId, publishedAt, duration, ... }]
        FE->>FE: Render project card grid
    end
```

---

## Journey: Create a New Editor Project (Manual)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "New Project" button
    FE->>BE: POST /api/editor { title: "Untitled Edit" }
    BE->>DB: INSERT INTO edit_projects { title, user_id }
    DB-->>BE: { id }
    BE-->>FE: { id, title }
    FE->>FE: Set activeProject → open EditorLayout
```

---

## Journey: Open Editor from Queue / Content ID

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Open in Editor" on a queue item
    FE->>FE: Navigate to /studio/editor?contentId=<generatedContentId>
    FE->>BE: POST /api/editor { generatedContentId: <id> }
    Note over BE: Upsert — gets existing project or creates new one
    BE->>DB: SELECT edit_projects WHERE generated_content_id=:id
    alt Project exists
        DB-->>BE: Existing project
    else
        BE->>DB: INSERT INTO edit_projects { generated_content_id, user_id }
        DB-->>BE: New project
    end
    BE-->>FE: { id, title, ... }
    FE->>FE: Set activeProject → open EditorLayout
    FE->>FE: Load content (hook, script, scenes) into editor context
```

---

## Journey: Work in the Timeline Editor

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend

    U->>FE: Drag clip on timeline
    FE->>FE: usePlayback: update clip start/end positions (local state)

    U->>FE: Scrub playhead
    FE->>FE: Seek video/audio to playhead position

    U->>FE: Click Play
    FE->>FE: Start playback — advance playhead in real time

    U->>FE: Resize audio clip (drag edge)
    FE->>FE: Update clip duration in track state

    U->>FE: Toggle track mute/solo (TrackHeader)
    FE->>FE: Apply audio routing change

    U->>FE: Click "Save"
    FE->>FE: Serialize timeline state → PATCH /api/editor/:id { timeline: { tracks, clips } }
```

---

## Journey: Link to AI Chat from Editor

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Open in AI Chat" on editor project card
    alt Project already has generatedContentId
        FE->>FE: Navigate to /studio/generate?sessionId=<linked_session_id>
    else No content linked yet
        FE->>BE: POST /api/editor/:id/link-content
        BE->>DB: INSERT INTO generated_content { edit_project_id: :id }
        DB-->>BE: { contentId, sessionId }
        BE-->>FE: { sessionId }
        FE->>FE: Navigate to /studio/generate?sessionId=<sessionId>
    end
```

---

## Journey: Delete an Editor Project

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Delete" on project card
    FE->>FE: Show confirmation dialog
    U->>FE: Confirm
    FE->>BE: DELETE /api/editor/:id
    BE->>DB: DELETE edit_projects WHERE id=:id
    BE-->>FE: { success: true }
    FE->>FE: Remove card from grid
```

---

## Auto-Creation of Editor Projects

When the AI generates new content in `/studio/generate`, the backend automatically calls `POST /api/editor` in the background to create an editor project linked to that content. This means by the time the user navigates to `/studio/editor`, a project already exists for their new content.

---

## Key Components

| Component | Purpose |
|---|---|
| `EditorLayout` | Full-screen timeline editor container |
| `Playhead` | Scrubbing indicator on the timeline |
| `TrackHeader` | Track label, mute/solo controls |
| `TimelineClip` | Draggable/resizable clip block on a track |
| `useWaveform` | Hook for rendering audio waveform |
| `usePlayback` | Hook for playback state and controls |
