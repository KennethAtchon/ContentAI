# Projects System — Domain Architecture

## Overview

Projects are named workspaces that group a user's chat sessions. Every chat session belongs to exactly one project. Projects give users a way to organize their creative work — e.g., separate projects per client, campaign, or content vertical.

---

## Architecture

```
frontend/src/features/
└── (no dedicated feature dir — projects are managed via chat feature)

backend/src/routes/
└── projects/index.ts   → CRUD for project records

backend/src/routes/
└── chat/index.ts       → sessions include projectId FK
```

---

## Data Model

### `projects` table

```typescript
{
  id: uuid PRIMARY KEY,
  userId: text NOT NULL,      // Firebase UID
  name: text NOT NULL,        // max 100 chars
  description: text,          // max 500 chars
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Relationship to chat sessions

`chatSessions` has a `projectId` foreign key. Creating a chat session requires a `projectId`. This means all AI-generated drafts are organized under a project hierarchy:

```
project → chatSession → chatMessage → generatedContent
```

---

## API Endpoints

### `GET /api/projects`

List all projects for the authenticated user, ordered by `updatedAt` descending.

**Auth:** `authMiddleware("user")`

**Response:**
```json
{
  "projects": [
    { "id": "uuid", "name": "My Campaign", "description": "...", "createdAt": "...", "updatedAt": "..." }
  ]
}
```

---

### `POST /api/projects`

Create a new project.

**Auth:** `authMiddleware("user")`, `csrfMiddleware()`

**Request body:**
```json
{ "name": "My New Project", "description": "Optional description" }
```

**Response 201:**
```json
{ "project": { "id": "uuid", "name": "...", ... } }
```

---

### `GET /api/projects/:id`

Fetch a single project (must belong to the authenticated user).

**Response:**
```json
{ "project": { "id": "uuid", "name": "...", ... } }
```

**Errors:** 404 if not found or owned by a different user.

---

### `PUT /api/projects/:id`

Update project name or description.

**Auth:** `authMiddleware("user")`, `csrfMiddleware()`

**Request body:** `{ "name"?: string, "description"?: string }`

---

### `DELETE /api/projects/:id`

Delete a project. Returns 409 if the project has existing chat sessions (must delete sessions first).

**Auth:** `authMiddleware("user")`, `csrfMiddleware()`

---

## Frontend Integration

Projects are created/selected in the chat UI before or during session creation. The chat feature's session creation flow (`POST /api/chat/sessions`) requires a `projectId`.

The AI chat system prompt includes the project name as context so the AI understands the user's working context:

```typescript
// In buildChatContext() — chat/index.ts
const context = `Project: ${project.name}`;
```

---

## Related Documentation

- [Chat Streaming System](./chat-streaming-system.md) — How chat sessions use projects
- [Generation System](./generation-system.md) — How content is generated within a session

---

*Last updated: March 2026*
