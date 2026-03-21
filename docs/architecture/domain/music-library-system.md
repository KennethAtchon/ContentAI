## Music Library System

This document explains how background music works — how it gets into the system, how it gets into videos, and what happens at the audio mixing stage.

---

## What the Music Library Is

The music library is a curated collection of background tracks that admins upload. Users can browse and preview tracks, then attach one to a piece of generated content. During video assembly, that track gets mixed underneath the voiceover.

Admins own the content. Users only browse and attach.

---

## How Tracks Get In

Admins upload MP3 files (up to 10MB) through the admin panel. Each upload goes directly to Cloudflare R2 under a `music/tracks/` path. The metadata (name, artist, mood, genre, duration) is stored in PostgreSQL, with the R2 object key as the link to the actual file.

Duration isn't decoded from the audio — it's estimated from file size assuming 128kbps encoding (~16,000 bytes/second). Good enough for a duration display; not precise enough for sync work (but this system doesn't do sync work).

---

## How Preview URLs Work

The database stores the R2 object key, not a URL. When the API returns tracks to users, it generates signed R2 URLs on the fly for each track (1-hour TTL). These URLs are included in the response payload as `previewUrl`.

The frontend caches this response, so it doesn't re-fetch preview URLs on every render — but the signed URLs will eventually expire if the user sits on the page for a long time. In practice this isn't a problem because the browsing session for picking music is short.

---

## Attaching Music to Content

"Attaching" a track to a piece of content creates a `reel_asset` row with `type: "music"`. This row just points to the track's R2 key. The content doesn't download or copy the track — it just records a reference.

There can only be one music track per piece of content at a time (the assembly pipeline uses the first `music` asset it finds).

---

## How Music Gets Into the Final Video

During video assembly, the pipeline:

1. Looks up all `reel_asset` rows for the content being assembled
2. Finds the one with `type: "music"` (if any)
3. Downloads the MP3 from R2 using a signed URL
4. Hands it to FFmpeg alongside the concatenated video and voiceover

FFmpeg mixes the audio using the amix filter. The voiceover plays at full volume (1.0x). The music plays at 22% volume (0.22x) — audible as a background texture, not dominant. The music plays for the duration of the video content (first audio stream's length), stopping when the content ends rather than looping or fading.

If no music track is attached, the assembly step skips the music input entirely. Audio mixing continues with whatever audio is present (voiceover, clip audio).

---

## Deleting a Track

Deleting a track removes both the PostgreSQL record and the R2 file. Any existing `reel_asset` rows that referenced it are left with a dangling key — they won't break assembly (the step logs and continues), but the music won't be included. In practice, tracks shouldn't be deleted once they're in active use.
