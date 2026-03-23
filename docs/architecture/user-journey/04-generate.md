# Generate Journey (AI Content Creation)

**Route:** `/studio/generate`
**Auth:** Required (`authType="user"`)

---

## Overview

The Generate page is the AI chat workspace where users create content. It is a three-column layout:

- **Left sidebar:** Projects list + Chat sessions list per project
- **Center:** Chat panel (message history + input)
- **Right:** Content Workspace (toggleable) — shows generated content drafts

---

## What the User Can Do

- Create and manage **projects** (logical groupings of content)
- Create **chat sessions** within a project
- Chat with an AI assistant to generate social media content
- Attach **reel references** to messages for context
- Attach **media assets** to messages
- Iterate on generated content ("make the hook more punchy")
- View all generated content drafts in the Workspace panel
- Add content to the production queue

---

## Journey: First-Time User (No Projects)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Navigate to /studio/generate
    FE->>BE: GET /api/projects
    BE->>DB: SELECT * FROM projects WHERE user_id=:uid
    DB-->>BE: []
    BE-->>FE: []
    FE->>FE: Render empty state: "Create your first project"

    U->>FE: Click "New Project"
    FE->>FE: Open CreateProjectModal
    U->>FE: Enter project name → Submit
    FE->>BE: POST /api/projects { name }
    BE->>DB: INSERT INTO projects { name, user_id }
    DB-->>BE: { id, name }
    BE-->>FE: Project created
    FE->>FE: Project appears in sidebar, URL → /studio/generate?projectId=<id>
```

---

## Journey: Create a Chat Session

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Select project in sidebar
    FE->>BE: GET /api/chat/sessions?projectId=<id>
    BE->>DB: SELECT * FROM chat_sessions WHERE project_id=:id ORDER BY updated_at DESC
    DB-->>BE: Sessions list (or [])
    BE-->>FE: Sessions

    alt No sessions
        FE->>FE: Show "New Chat" empty state
        U->>FE: Click "New Chat"
        FE->>BE: POST /api/chat/sessions { projectId }
        BE->>DB: INSERT INTO chat_sessions { project_id, title: "New Chat Session" }
        DB-->>BE: { sessionId }
        BE-->>FE: { sessionId }
        FE->>FE: URL → /studio/generate?projectId=<id>&sessionId=<sid>
        FE->>FE: Render empty ChatPanel
    else Sessions exist
        FE->>FE: Auto-select most recent session
        FE->>BE: GET /api/chat/sessions/:id/messages
        BE-->>FE: Message history
        FE->>FE: Render ChatPanel with history
    end
```

---

## Journey: Send a Message and Generate Content

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant AI as Claude (Generation Model)
    participant DB as PostgreSQL

    U->>FE: Type message in chat input
    U->>FE: (Optional) Attach reel refs via ReelPickerModal
    U->>FE: (Optional) Attach media assets
    U->>FE: Press Enter / Click Send

    FE->>BE: POST /api/chat/sessions/:id/messages { content, reelRefs?, mediaRefs?, activeContentId? }
    BE->>BE: usageGate("generation") — check plan limit
    alt Limit exceeded
        BE-->>FE: 429 { limitReached: true }
        FE->>FE: Show LimitHitModal
    else Limit OK
        BE->>DB: INSERT INTO messages { role: "user", content, session_id }
        BE->>BE: Auto-title session from first message (first 50 chars) if untitled
        BE->>DB: Build context (project name + reel summaries + active draft)
        BE->>AI: streamText(system_prompt, context, messages, tools)
        Note over AI,BE: AI streams response token-by-token (SSE)
        BE-->>FE: UI message stream (SSE)
        FE->>FE: Render tokens as they arrive (useChatStream)

        alt AI calls save_content tool
            AI->>BE: Tool call: save_content { hook, caption, script, hashtags }
            BE->>DB: INSERT INTO generated_content { hook, caption, script, ... }
            BE->>BE: POST /api/editor (auto-create editor project in background)
        else AI calls iterate_content tool
            AI->>BE: Tool call: iterate_content { contentId, hook, caption, ... }
            BE->>DB: INSERT INTO generated_content { parentId: <prev>, version: N+1 }
        end

        BE->>DB: INSERT INTO messages { role: "assistant", content }
        BE-->>FE: Stream complete + { streamingContentId }
        FE->>FE: Invalidate queue cache
        FE->>FE: Update Content Workspace with new draft
    end
```

---

## Journey: Attach a Reel Reference

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Click "Attach Reel" icon in chat input
    FE->>FE: Open ReelPickerModal
    U->>FE: Search / browse reels in modal
    FE->>BE: GET /api/reels?search=<term>&limit=10
    BE-->>FE: Matching reels
    FE->>FE: Show reel results in modal
    U->>FE: Select one or more reels → Confirm
    FE->>FE: Close modal, show reel chips in message input area
    U->>FE: Send message with reel refs
    Note over FE,BE: reelRefs included in POST /api/chat/sessions/:id/messages
    Note over BE: Backend includes reel summary in AI context string
```

---

## Journey: Content Workspace (Right Panel)

The right panel shows all generated content drafts for the current session.

**Toggle:** Click "Workspace" button in session header to open/close.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Workspace" button
    FE->>BE: GET /api/chat/sessions/:id/content
    BE->>DB: SELECT generated_content WHERE session_id=:id (chain-tip drafts only)
    DB-->>BE: [{ id, hook, caption, script, hashtags, version, parentId }]
    BE-->>FE: Content drafts
    FE->>FE: Render content cards in Workspace

    U->>FE: Click a content card
    FE->>FE: Expand: show full hook, caption, script, scene description, assets
    FE->>FE: Show action buttons: "Open Audio", "Add to Queue"

    U->>FE: Click "Open Audio"
    FE->>FE: Navigate to audio workspace for this content item
    Note over FE: See 05-audio.md

    U->>FE: Click "Add to Queue"
    FE->>BE: POST /api/queue { generatedContentId }
    BE->>DB: INSERT INTO queue_items { content_id, status: "draft" }
    BE->>DB: UPDATE generated_content SET status="queued"
    BE-->>FE: { queueItemId }
    FE->>FE: Show "Added to Queue" toast
    FE->>FE: Invalidate queue cache
```

---

## Journey: Iterate on Generated Content

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant AI as Claude
    participant DB as PostgreSQL

    U->>FE: Type "make the hook more punchy" with activeContentId set
    FE->>BE: POST /api/chat/sessions/:id/messages { content: "make hook punchier", activeContentId: 42 }
    BE->>DB: Fetch content #42 as iteration base context
    BE->>AI: streamText with current draft + iteration instruction
    AI->>BE: Tool call: iterate_content { contentId: 42, hook: "New punchier hook..." }
    BE->>DB: INSERT INTO generated_content { parentId: 42, version: 2, hook: "..." }
    BE-->>FE: Stream complete + { streamingContentId: 43 }
    FE->>FE: Workspace shows new version as chain tip
    FE->>FE: User can navigate version history (parentId chain)
```

---

## Content Version Chain

Generated content forms a **version chain** (linked list by `parentId`). The Workspace shows only the chain-tip (latest version) by default, but users can navigate the version history.

```
Content #1 (v1, parentId=null)
    └── Content #2 (v2, parentId=1)
            └── Content #3 (v3, parentId=2)  ← chain tip (shown in Workspace)
```

---

## Key Components

| Component | Location | Purpose |
|---|---|---|
| `ChatLayout` | `features/chat/components/ChatLayout.tsx` | Full three-column generate workspace |
| `ChatPanel` | `features/chat/components/` | Message history + input |
| `ContentWorkspace` | `features/chat/components/` | Right panel showing drafts |
| `ReelPickerModal` | `features/reels/components/` | Reel search + selection for chat context |
| `CreateProjectModal` | `features/projects/components/` | New project form |
