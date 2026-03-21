# 04 -- Project Model: 1:1 Binding, Publish/Draft, Locking

**Priority:** Phase 1 (build first)
**Effort:** Medium (1.5-2 weeks)
**Dependencies:** None -- this is foundational

---

## User Problem

Right now, the editor and the content pipeline are disconnected. A user generates content in chat, sees it in the queue, but opening the editor means creating a blank project and manually adding clips. There is no inherent connection between "the reel I generated" and "the editor project I am editing." This means:

1. Users do not understand what the editor is for. It feels like a separate tool stapled onto the platform.
2. There is no guard against editing multiple versions simultaneously. A user could open two editor projects for the same generated content and create conflicting edits.
3. There is no concept of "done." A user never publishes or finalizes. The editor project sits in draft limbo forever.

The project model solves all three problems by making the editor the natural next step after generation, enforcing one edit per content, and introducing a publish/lock flow.

---

## User Stories

- As a creator, I want to open the editor directly from my queue item so that my generated shots, voiceover, and music are already loaded.
- As a creator, I want exactly one editor project per piece of generated content so that I do not accidentally create conflicting edits.
- As a creator, I want to publish my reel, which locks it from further editing, so that I have a clean record of what I posted.
- As a creator, I want to create a new draft version from a published reel so that I can iterate without losing the original.

---

## In Scope (MVP)

### 1. Enforce 1:1 Binding (One Editor Project Per Generated Content)

**Current behavior:** The `editProjects` table has a nullable `generatedContentId` column. A user can create unlimited editor projects, optionally linked to content. There is no uniqueness constraint.

**New behavior:**
- Add a **unique constraint** on `(user_id, generated_content_id)` where `generated_content_id IS NOT NULL`
- The "New Project" button on the editor page is removed. Editor projects are only created from the queue.
- The backend `POST /api/editor` endpoint, when given a `generatedContentId`, checks for an existing project. If one exists, it returns the existing project instead of creating a new one (upsert behavior).
- Standalone editor projects (no generated content) are still allowed for users who want to edit their own uploaded footage. But the primary flow is always queue -> editor.

**Schema change:**

```sql
ALTER TABLE edit_project
  ADD CONSTRAINT edit_project_unique_content
  UNIQUE (user_id, generated_content_id)
  WHERE generated_content_id IS NOT NULL;
```

In Drizzle:

```typescript
uniqueIndex("edit_project_unique_content")
  .on(t.userId, t.generatedContentId)
  .where(sql`${t.generatedContentId} IS NOT NULL`)
```

**Backend change in `POST /api/editor`:**

```typescript
// If generatedContentId is provided, check for existing project
if (parsed.data.generatedContentId) {
  const [existing] = await db
    .select()
    .from(editProjects)
    .where(
      and(
        eq(editProjects.userId, auth.user.id),
        eq(editProjects.generatedContentId, parsed.data.generatedContentId),
      ),
    )
    .limit(1);

  if (existing) {
    return c.json({ project: existing }, 200); // Return existing, not 201
  }
}
// Otherwise create new
```

### 2. Open Editor From Queue

**Current flow:** Queue -> click "Edit" -> see detail sheet -> no direct link to editor.

**New flow:** Queue -> click "Edit in Studio" button on the detail sheet -> creates or opens the editor project for this `generatedContentId` -> editor opens with all assets pre-loaded.

**Frontend changes:**

In the queue detail sheet, add an "Open in Editor" button:

```typescript
<Link
  to="/studio/editor"
  search={{ contentId: item.generatedContentId }}
>
  Open in Editor
</Link>
```

In the editor route (`/studio/editor`), read the `contentId` search param:

```typescript
export const Route = createFileRoute("/studio/editor")({
  validateSearch: (search) => ({
    contentId: search.contentId as number | undefined,
  }),
  component: EditorPage,
});
```

When `contentId` is present:
1. Call `POST /api/editor` with `{ generatedContentId: contentId }` to get-or-create the project
2. Immediately open the `EditorLayout` for that project (skip the project list view)

When `contentId` is absent, show the project list as today.

### 3. Auto-Initialize Timeline From Pipeline Assets

**Problem:** When the editor opens for a generated content for the first time, the timeline is empty. The user has to manually add clips from the media panel. This is tedious when the pipeline has already generated 5 video clips, a voiceover, and music.

**Solution:** On first creation of an editor project (when `POST /api/editor` creates a new record), the backend auto-populates the `tracks` field:

1. Query all assets for the `generatedContentId`
2. Sort video clips by their `shotIndex` or creation order
3. Place them sequentially on the video track (clip 1 starts at 0, clip 2 starts at clip 1 end, etc.)
4. Place the voiceover on the audio track starting at 0
5. Place the music on the music track starting at 0
6. Calculate total `durationMs`
7. Save all this as the initial `tracks` JSONB

```typescript
async function buildInitialTimeline(generatedContentId: number, userId: string): Promise<TrackData[]> {
  const contentAssets = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.generatedContentId, generatedContentId),
        eq(assets.userId, userId),
      ),
    )
    .orderBy(assets.createdAt);

  const videoClips = contentAssets.filter(a => a.type === "video_clip");
  const voiceovers = contentAssets.filter(a => a.type === "voiceover");
  const music = contentAssets.filter(a => a.type === "music");

  let videoPosition = 0;
  const videoTrackClips = videoClips.map(asset => {
    const duration = asset.durationMs ?? 5000;
    const clip = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      r2Key: asset.r2Key,
      startMs: videoPosition,
      durationMs: duration,
      trimStartMs: 0,
      trimEndMs: 0,
      speed: 1,
      volume: 1,
      muted: false,
    };
    videoPosition += duration;
    return clip;
  });

  return [
    { type: "video", muted: false, locked: false, name: "Video", clips: videoTrackClips },
    { type: "audio", muted: false, locked: false, name: "Audio", clips: voiceovers.map(a => ({
      id: crypto.randomUUID(), assetId: a.id, r2Key: a.r2Key,
      startMs: 0, durationMs: a.durationMs ?? videoPosition,
      trimStartMs: 0, trimEndMs: 0, speed: 1, volume: 1, muted: false,
    }))},
    { type: "music", muted: false, locked: false, name: "Music", clips: music.map(a => ({
      id: crypto.randomUUID(), assetId: a.id, r2Key: a.r2Key,
      startMs: 0, durationMs: a.durationMs ?? videoPosition,
      trimStartMs: 0, trimEndMs: 0, speed: 1, volume: 0.3, muted: false,
    }))},
    { type: "text", muted: false, locked: false, name: "Text", clips: [] },
  ];
}
```

**This means the editor opens ready to play.** The user sees their shots in order, hears the voiceover, and can immediately start editing. This is the moment that makes the product feel integrated.

### 4. Publish and Lock Model

**Concept:** A reel has two states: **draft** and **published**. When published, the editor project is locked -- no further edits. If the user wants to change something, they create a new draft version (which copies the timeline and starts a new editor project linked to the same generated content -- or more precisely, linked to a duplicated generated content).

**Schema addition:**

```sql
ALTER TABLE edit_project ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
-- Values: 'draft', 'published'

ALTER TABLE edit_project ADD COLUMN published_at TIMESTAMP;
ALTER TABLE edit_project ADD COLUMN parent_project_id TEXT REFERENCES edit_project(id);
```

In Drizzle:

```typescript
status: text("status").notNull().default("draft"), // "draft" | "published"
publishedAt: timestamp("published_at"),
parentProjectId: text("parent_project_id").references(() => editProjects.id),
```

**Publish endpoint:**

```
POST /api/editor/:id/publish
Response: { id, status: "published", publishedAt }
```

Behavior:
1. Verify the project exists and is owned by the user
2. Verify the project has been exported (an export job with status "done" exists) -- you cannot publish without a final video
3. Set `status = 'published'`, `published_at = NOW()`
4. The project is now read-only. `PATCH /api/editor/:id` returns 403 if `status = 'published'`.

**Create new draft from published:**

```
POST /api/editor/:id/new-draft
Response: { project: EditProject } -- a new project with status 'draft', parentProjectId set
```

Behavior:
1. Verify source project is published
2. Duplicate the generated content (create a new `generatedContent` row with `parentId` pointing to the original, copying the copy/script)
3. Create a new editor project linked to the new `generatedContentId`, copying the timeline from the published project
4. The new draft starts with the same timeline state so the user can iterate from where they left off

**Frontend UI:**

- In the editor toolbar, the Export button is joined by a "Publish" button (appears after a successful export)
- Clicking Publish shows a confirmation modal: "Publishing will lock this reel. You will not be able to edit it further. To make changes, you will need to create a new draft version."
- Published projects in the project list show a badge ("Published") and the "Open" button changes to "View" (read-only mode)
- A "Create New Draft" button appears on published projects

**Read-only mode in editor:**
- When `project.status === "published"`, the editor opens in view-only mode
- All clip manipulation is disabled (no drag, no trim, no add)
- Inspector sliders are disabled
- Toolbar shows "Published" badge instead of edit controls
- "Create New Draft" button is prominent

### 5. Version History Display

**Not a full version history system.** Just enough to show the relationship between drafts.

In the project list, group projects by their `generatedContentId`:
- Show the generated content title
- Under it, show versions: "v1 (published)", "v2 (draft)"
- The parent-child chain (`parentProjectId`) determines version numbers

This gives the user a sense of iteration without building a full version control system.

---

## Out of Scope (Defer)

- **Branching** (creating multiple drafts from the same published version) -- the 1:1 content-to-project constraint prevents this by design. If needed later, relax the constraint.
- **Unpublish** (reverting a published project back to draft) -- keep it simple. Published means published. Create a new draft if you need to change something.
- **Scheduled publishing** (publish at a specific time to Instagram) -- this is a separate feature (social media scheduling) that belongs in the queue, not the editor.
- **Publishing to Instagram/TikTok directly** -- requires API integration with those platforms. Major separate effort.
- **Collaborative editing** (multiple users editing the same project) -- way out of scope.

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Unique constraint on `(user_id, generated_content_id)` conflicts with the version/draft model | Medium | The constraint only applies when `generated_content_id IS NOT NULL`. When creating a new draft, a new `generatedContent` row is created (via duplication), so the new editor project has a different `generatedContentId`. No conflict. |
| Auto-initializing the timeline depends on assets existing | Low | If assets have not finished generating when the user opens the editor, show a loading state: "Your shots are still being generated. The editor will populate automatically when they are ready." Poll `GET /api/assets` and update the timeline when new assets appear. |
| Published projects accumulate and waste storage | Low | Published projects are small (JSONB timeline + pointers to R2 assets). The assets themselves are shared. No storage concern in the near term. |
| Users confused by read-only mode | Medium | Make the "Published" state visually distinct (muted colors, lock icon, prominent "Create New Draft" CTA). Users should never wonder why they cannot edit. |

---

## Implementation Sequence

1. Schema: add unique constraint, `status`, `publishedAt`, `parentProjectId` columns + migration -- 1 day
2. Backend: modify `POST /api/editor` to upsert behavior + auto-initialize timeline -- 2 days
3. Backend: `POST /api/editor/:id/publish` + `POST /api/editor/:id/new-draft` endpoints -- 1 day
4. Backend: enforce read-only on `PATCH` when published -- 0.5 day
5. Frontend: queue detail sheet "Open in Editor" button + search param routing -- 1 day
6. Frontend: read-only mode in EditorLayout when published -- 1 day
7. Frontend: Publish button + confirmation modal + published badge -- 1 day
8. Frontend: "Create New Draft" flow -- 1 day
9. Frontend: version grouping in project list -- 1 day
10. Testing -- 1.5 days

**Total estimated effort:** ~11 working days
