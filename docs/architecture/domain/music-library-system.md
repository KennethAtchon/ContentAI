# Music Library System — Domain Architecture

## Overview

The Music Library provides a curated collection of background music tracks that users can attach to their assembled videos. Admins upload and manage tracks via the admin panel; users browse and select tracks during video production.

---

## Architecture

```
frontend/src/features/studio/   → Music track picker in video workspace
frontend/src/routes/admin/_layout/music.tsx → Admin music management page

backend/src/routes/music/index.ts          → User-facing music endpoints
backend/src/routes/admin/music.ts          → Admin CRUD endpoints

Storage: Cloudflare R2
  music/tracks/{trackId}.mp3   → Audio files
```

---

## Data Model

### `music_tracks` table

```typescript
{
  id: serial PRIMARY KEY,
  name: text NOT NULL,
  artistName: text,
  durationSeconds: integer,
  mood: text,           // "energetic" | "calm" | "dramatic" | "funny" | "inspiring"
  genre: text,
  r2Key: text NOT NULL, // R2 object key for the MP3
  isActive: boolean DEFAULT true,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## User-Facing Endpoints

### `GET /api/music/library`

Browse available tracks with search, mood filter, and duration bucket filter.

**Auth:** `authMiddleware("user")`

**Query params:**
- `search` — text search on name/artist
- `mood` — filter by mood value
- `durationBucket` — `"15"` (≤20s), `"30"` (21–45s), `"60"` (46–90s)
- `page`, `limit` (max 50)

**Response:**
```json
{
  "tracks": [
    {
      "id": 1,
      "name": "Upbeat Summer",
      "artistName": "Studio Beats",
      "durationSeconds": 30,
      "mood": "energetic",
      "genre": "pop",
      "previewUrl": "https://signed-r2-url..."
    }
  ],
  "total": 42,
  "page": 1
}
```

Preview URLs are signed R2 URLs (1-hour TTL) generated per request.

---

### `POST /api/music/attach`

Attach a music track to a `generatedContent` item as a `reel_asset`.

**Auth:** `authMiddleware("user")`, `csrfMiddleware()`

**Request body:**
```json
{ "generatedContentId": 123, "musicTrackId": 5 }
```

Creates a `reel_asset` row of type `"music"` pointing to the track's R2 key. This asset is then picked up by the video assembly pipeline when mixing audio.

---

## Admin Endpoints

### `GET /api/admin/music`

List all tracks including inactive ones (admins can see everything).

**Auth:** `authMiddleware("admin")`

---

### `POST /api/admin/music`

Upload a new track via multipart form data.

**Auth:** `authMiddleware("admin")`, `csrfMiddleware()`

**Form fields:**
- `file` — MP3 file (max 10MB, must be `audio/mpeg`)
- `name` — track name (required)
- `artistName` — optional
- `mood` — required: `energetic` | `calm` | `dramatic` | `funny` | `inspiring`
- `genre` — optional

Duration is estimated from file size (128kbps: ~16,000 bytes/sec).

---

### `PUT /api/admin/music/:id`

Update track metadata or toggle `isActive`.

---

### `DELETE /api/admin/music/:id`

Delete the track record and the R2 file.

---

## How Music Gets Into Assembled Videos

During video assembly (`POST /api/video/assemble`), the pipeline:

1. Loads all `reel_asset` rows for the `generatedContentId`
2. Finds the asset with `type = "music"` (if present)
3. Downloads the music file from R2 using a signed URL
4. Mixes it at **0.22x volume** under the voiceover and video audio

Audio mixing formula:
```bash
[vo]volume=1.0[vo_out]; [music]volume=0.22[music_out];
[vo_out][music_out]amix=inputs=2:duration=first[mix]
```

See [Reel Generation System](./reel-generation-system.md) for the full mixing spec.

---

## Related Documentation

- [Reel Generation System](./reel-generation-system.md) — Audio mixing pipeline
- [Audio & TTS System](./audio-tts-system.md) — Voiceover generation
- [Admin Dashboard](./admin-dashboard.md) — Music admin UI

---

*Last updated: March 2026*
