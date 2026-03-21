# Media Library Feature Plan

## Overview

Three interconnected features:
1. **Media Library** — user-owned R2-backed media items (video, image, audio), separate from `reel_asset`
2. **Chat Video Upload** — attach video files to chat messages via the media library
3. **Editor Integration** — browse and use library items in the editor `MediaPanel`

---

## Affected Files

### Backend — new/modified
| File | Change |
|---|---|
| `backend/src/infrastructure/database/drizzle/schema.ts` | Add `mediaItems` table; add `mediaRefs` JSONB column to `chatMessages` |
| `backend/src/routes/media/index.ts` | **New** — `GET /api/media`, `POST /api/media/upload`, `DELETE /api/media/:id` |
| `backend/src/index.ts` | Register `/api/media` route |
| `backend/src/routes/chat/index.ts` | Accept + persist `mediaRefs` in `sendMessageSchema` and message insert; include in GET response |

### Frontend — new
| File | Purpose |
|---|---|
| `frontend/src/features/media/types/media.types.ts` | `MediaItem` type, request/response shapes |
| `frontend/src/features/media/services/media.service.ts` | Upload, list, delete API calls |
| `frontend/src/features/media/hooks/use-media-library.ts` | Query + mutation hooks |
| `frontend/src/features/media/components/MediaLibraryModal.tsx` | Modal for browsing/uploading media |
| `frontend/src/features/media/components/MediaUploadZone.tsx` | Drag-and-drop + file picker |
| `frontend/src/features/media/components/MediaItemCard.tsx` | Grid card (thumbnail, duration, delete) |
| `frontend/src/features/chat/components/VideoRefCard.tsx` | Badge for an attached media item in chat input |

### Frontend — modified
| File | Change |
|---|---|
| `frontend/src/features/chat/types/chat.types.ts` | Add `mediaRefs?: string[]` to `ChatMessage` and `SendMessageRequest` |
| `frontend/src/features/chat/components/ChatInput.tsx` | Video upload button, `VideoRefCard` display, pass `mediaRefs` on send |
| `frontend/src/features/editor/components/MediaPanel.tsx` | Add "My Library" section in Media tab |
| `frontend/src/shared/lib/query-keys.ts` | Add `mediaLibrary` query key |
| `frontend/src/translations/en.json` | Add all new i18n keys |

---

## DB Changes

### New table: `media_item`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `crypto.randomUUID()` |
| `userId` | text NOT NULL | references `users.id`, onDelete: cascade |
| `name` | text NOT NULL | original filename |
| `type` | text NOT NULL | `"video" \| "image" \| "audio"` |
| `mimeType` | text NOT NULL | |
| `r2Key` | text NOT NULL | |
| `r2Url` | text | public URL |
| `sizeBytes` | integer | |
| `durationMs` | integer | nullable — video/audio only |
| `metadata` | jsonb | default `{}` |
| `createdAt` | timestamp | defaultNow |

Indexes: `media_item_user_idx` on `userId`.

### Modify `chatMessages`

Add column: `mediaRefs jsonb` — nullable array of `media_item.id` strings. Same pattern as existing `reelRefs`.

### Migration
```bash
cd backend && bun db:generate && bun db:migrate
```

---

## Backend Route: `/api/media`

All routes require `rateLimiter("customer")` + `authMiddleware("user")`. Mutations also require `csrfMiddleware()`.

### `GET /`
- Select all `mediaItems` where `userId = auth.user.id`, ordered by `createdAt DESC`
- Generate fresh signed URL for each item via `getFileUrl(r2Key, 3600)`
- Return `{ items: [...] }`

### `POST /upload`
- Accept multipart form: `file` (File), optional `name` override
- Validate MIME:
  - Video: `video/mp4`, `video/quicktime` — max 500 MB
  - Audio: `audio/mpeg`, `audio/wav`, `audio/mp4` — max 50 MB
  - Image: `image/jpeg`, `image/png`, `image/webp` — max 10 MB
- R2 key: `media/library/{userId}/{uuid}.{ext}`
- Upload to R2, insert into `mediaItems`, return item with fresh signed URL

### `DELETE /:id`
- Verify `userId` ownership
- Delete R2 file via `deleteFile(r2Key)`
- Delete DB row
- Return 204

---

## Backend Chat Update

In `sendMessageSchema`:
```ts
mediaRefs: z.array(z.string()).optional()
```

In message insert: `mediaRefs: body.mediaRefs ?? null`

GET session messages already returns all columns (JSONB is passed through automatically).

---

## Frontend: Types

**`media.types.ts`:**
```ts
export interface MediaItem {
  id: string;
  userId: string;
  name: string;
  type: "video" | "image" | "audio";
  mimeType: string;
  r2Url: string | null;
  mediaUrl?: string;        // fresh signed URL from backend
  sizeBytes: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

**`chat.types.ts` additions:**
- `ChatMessage.mediaRefs?: string[]`
- `SendMessageRequest.mediaRefs?: string[]`

---

## Frontend: Hooks

**`use-media-library.ts`:**
- `useMediaLibrary()` — `useQuery` with `queryKeys.api.mediaLibrary()`, GET `/api/media`
- `useUploadMedia()` — `useMutation`, POST multipart to `/api/media/upload`, invalidates `mediaLibrary` key on success
- `useDeleteMedia()` — `useMutation`, DELETE `/api/media/:id`, invalidates `mediaLibrary` key

---

## Frontend: Chat Changes

**`ChatInput` state additions:**
- `attachedMedia: MediaItem[]`
- `isUploadingVideo: boolean`

**New button** (next to existing paperclip):
- Icon: `Video` from lucide-react
- Opens hidden file input: `accept="video/mp4,video/quicktime"`
- On file select: calls upload mutation inline, shows loading spinner, on success appends to `attachedMedia`

**`VideoRefCard`:**
- Badge: video icon + truncated filename + file size + remove button
- Same visual style as `ReelRefCard`

**Send flow:**
- `onSendMessage(content, reelRefs, mediaRefs)` — `mediaRefs = attachedMedia.map(m => m.id)`
- Clear `attachedMedia` after successful send

---

## Frontend: Editor MediaPanel

In the "Media" tab, below the existing video asset grid:

- Heading: "My Library"
- Renders library video items from `useMediaLibrary()` in same 2-col grid
- Click to add: calls `addVideoClip` with `mediaUrl` and item name as label
- Upload button: opens `MediaUploadZone` inline (or calls file picker directly) to add new items

---

## i18n Keys to Add (`en.json`)

```json
"media_library_title": "Media Library",
"media_library_upload": "Upload",
"media_library_upload_video": "Upload Video",
"media_library_empty": "No media yet. Upload a video to get started.",
"media_library_delete": "Delete",
"media_library_uploading": "Uploading…",
"media_library_tab": "Library",
"chat_attach_video": "Attach video",
"editor_media_library_section": "My Library",
"editor_media_upload": "Upload to library"
```

---

## Build Order

1. Schema — add `mediaItems` table + `mediaRefs` on `chatMessages`
2. Migration — `bun db:generate && bun db:migrate`
3. Backend `/api/media` route — new file
4. Register route in `backend/src/index.ts`
5. Update chat route — `mediaRefs` in schema + insert
6. Frontend `media.types.ts` + update `chat.types.ts`
7. Frontend `query-keys.ts` — add `mediaLibrary` key
8. Frontend `en.json` — add i18n keys
9. Frontend `media.service.ts` + `use-media-library.ts`
10. `VideoRefCard` component
11. `ChatInput` — video button + `VideoRefCard` + pass `mediaRefs`
12. `MediaItemCard` + `MediaUploadZone` + `MediaLibraryModal`
13. `MediaPanel` — add library section
14. Lint: `bun lint` in frontend + backend
