## Manual Editor System

This document explains how the timeline editor actually works — the composition model, autosave, conflict detection, and why rendering is separate from editing.

---

## What a Composition Is

A "composition" is the saved state of a user's timeline edits for one piece of generated content. It's a separate record from the content itself, and there's exactly one composition per user+content pair.

The composition holds a `timeline` object — tracks for video clips, audio, text overlays, captions. Each video item in the timeline knows which asset it uses, where it starts and ends in time, and how it's trimmed. The composition also has a version number.

When you close the editor and come back, you're returned to your exact previous state — every trim, every clip order, every text overlay. The composition is the persistent "work in progress" for your edit.

---

## How the Editor Initializes

Opening the editor always calls a `/init` endpoint first. This endpoint does two things:

**If no composition exists yet:** it loads all the video clip assets for that piece of content, arranges them into a default timeline (clips in order), and saves a new composition record (version 1). This is the "first time editing this draft" path.

**If a composition already exists:** it just returns the existing record. Nothing is rebuilt.

After init, the frontend fires a second read to get the canonical server version of the composition. This is what populates the undo history baseline — so your first "undo" goes back to the server state, not some intermediate local state.

This two-step setup (init + GET) means the editor always starts from server truth, even if a previous session ended abnormally.

---

## How Editing Works (Local-First)

Edits are local until autosave. When you drag a clip, trim, reorder, or add from the media bin, that change updates local React state immediately — the UI responds instantly. The change is also pushed into the undo history stack.

Nothing is saved to the server on every edit. If you make 20 changes in 5 seconds, those 20 changes all stay local.

Autosave runs 800ms after the last change. It computes a hash of the timeline to detect whether anything actually changed (prevents saving when nothing changed). If there's a diff, it sends the timeline to the server.

---

## Version Numbers and Conflict Detection

Every successful save increments the composition's version number. The frontend always tracks the current version and sends it with every save request as `expectedVersion`.

The server checks: does the version in the database match what the client claims? If yes, the save goes through and the version increments. If no — meaning something else (another tab, another device) saved in the meantime — the server returns a 409 conflict error.

When a 409 happens, the autosave enters an error state. The user needs to refresh to reload the server's version and start editing from that state. There's no automatic merge — the server version wins.

This prevents two browser tabs from silently overwriting each other's edits.

---

## Why Rendering Is Separate From Saving

Rendering (turning the timeline into a real video file) is an expensive, time-consuming operation that runs as a background job. It's completely separate from saving.

When you click Render:
1. The server validates the currently saved (database) version of the timeline
2. If the version matches and the timeline is valid, it creates a background job and returns immediately with a job ID
3. The frontend polls the job status until it's done

**Critical detail:** rendering uses the version that's in the database, not whatever you have locally in the browser. If you have unsaved edits, those won't be in the rendered video. The UI should save before rendering (and warns if there are unsaved changes).

A Redis lock prevents the same composition version from being rendered twice simultaneously. If a render is already in progress for that version, the API returns the existing job ID instead of creating a new one.

---

## Undo/Redo

The editor keeps an in-memory history stack. Every timeline change records a snapshot of the previous state. Cmd+Z restores the previous snapshot into local state — this immediately updates the UI, and the change then flows through autosave like any other edit.

Undo doesn't make a network call. It's pure local state restoration. The debounced autosave handles persisting it.

---

## The Edit Mode (Quick vs Precision)

Compositions track an `editMode` field — either `quick` or `precision`. This affects which tooling panels appear in the editor UI. The mode is persisted with the composition so it's remembered between sessions.

On mobile, the shell forces `quick` mode regardless of the saved preference, because precision editing (fine-grained timeline scrubbing, split operations) doesn't work well on touch.

---

## Caption transcription (Whisper)

Timeline captions can be driven by **word-level timing** from audio, not only manual text. The backend exposes **`/api/captions`** (mounted separately from `/api/editor`):

**POST `/api/captions/transcribe`** — Body: `{ "assetId": "<uuid>" }`. The asset must belong to the user and have `type` `voiceover` or `audio`, with an `r2Key`. The server downloads the file from R2 (max **25 MB** for Whisper), calls OpenAI **Whisper** (`whisper-1`) with `verbose_json` and word timestamps, converts seconds to milliseconds, and stores a row in the `captions` table.

**Idempotency:** If a caption row already exists for that `assetId` and user, the handler returns the existing words and text without calling Whisper again (avoids duplicate charges).

**GET `/api/captions/:assetId`** — Returns stored `words`, `fullText`, and `captionId` for that asset, or 404 if none.

This is distinct from **assembly-time burned-in captions** in the [Reel Generation System](./reel-generation-system.md), which derive timing from script chunks. Whisper captions are for **editable, time-aligned** caption tracks in the editor UI.

---

## What Happens If Two Saves Conflict

If you have the editor open in two browser tabs and both try to save, here's what happens:

Tab A saves first. Version goes from 3 → 4. Tab B tries to save with `expectedVersion: 3`. Server rejects with 409. Tab B shows an error. Tab B's edits are not lost (they're still in local state), but the user has to manually refresh to reconcile with the server state.

There's no background conflict resolution. The 409 is intentional — silent overwrites would be worse.
