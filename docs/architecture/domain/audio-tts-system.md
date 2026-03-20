# Audio & TTS System — Domain Architecture

## Overview

The Audio system handles two distinct features:

1. **Text-to-Speech (TTS)** — Converts AI-generated scripts into MP3 voiceovers using ElevenLabs. The generated audio file is stored in R2 and linked to the `generatedContent` record as a `reel_asset`.

2. **Trending Audio** — Surfaces the most-used audio tracks from scraped reels, showing velocity (rising/stable/declining) so users can pick audio that's currently performing well.

---

## Architecture

```
frontend/src/features/audio/   → TTS generation + voice selector UI
frontend/src/features/reels/   → Trending audio panel

backend/src/routes/audio/index.ts
  ├── GET  /api/audio/voices        → Available voice catalog
  ├── GET  /api/audio/trending      → Trending audio from reel scrapes
  └── POST /api/audio/tts           → Generate voiceover from script

backend/src/services/tts/elevenlabs.ts  → ElevenLabs API wrapper
backend/src/config/voices.ts            → Voice catalog (frontend IDs ↔ ElevenLabs IDs)
```

---

## Voice Catalog

Five voices are available, each mapped to an ElevenLabs voice ID. The mapping is a static config (`backend/src/config/voices.ts`) — adding a new voice means adding an entry there.

| ID | Name | Gender | Best for |
|---|---|---|---|
| `jessica-v1` | Jessica | Female | Lifestyle, wellness |
| `marcus-v1` | Marcus | Male | Education, business |
| `laura-v1` | Laura | Female | Fitness, motivation |
| `james-v1` | James | Male | Tutorials, professional |
| `nova-v1` | Nova | Neutral | Storytelling, personal |

---

## TTS Generation Flow

```
User picks voice + script → POST /api/audio/tts
    → sanitizeScriptForTTS() (strips timing markers, stage directions, etc.)
    → ElevenLabs generateSpeech(text, voice, speed)
    → Upload MP3 to R2 (audio/voiceovers/{userId}/{assetId}.mp3)
    → Insert reel_asset row (type: "voiceover")
    → Record AI cost
    → Return { asset, signedUrl, durationMs }
```

### Script Sanitization

Before sending to ElevenLabs, the script is cleaned:
- Timing markers removed: `[0-3s]`, `[0:03]`
- Stage directions removed: `(video of...)`, `(cut to...)`
- Bracketed labels removed: `[HOOK]`, `[Scene 1]`
- Bullet/dash markers removed
- Section labels removed: `Hook:`, `CTA:`

This prevents ElevenLabs from vocalizing production metadata.

---

## API Endpoints

### `GET /api/audio/voices`

Returns the voice catalog with signed preview URLs.

**Auth:** `authMiddleware("user")`

**Response:**
```json
{
  "voices": [
    {
      "id": "jessica-v1",
      "name": "Jessica",
      "description": "Warm, conversational female voice...",
      "gender": "female",
      "previewUrl": "https://signed-r2-url..."
    }
  ]
}
```

---

### `POST /api/audio/tts`

Generate a voiceover from a script.

**Auth:** `authMiddleware("user")`, `csrfMiddleware()`, rate-limited

**Request body:**
```json
{
  "generatedContentId": 123,
  "text": "The script text to speak...",
  "voiceId": "jessica-v1",
  "speed": "normal"
}
```

`speed`: `"slow"` | `"normal"` | `"fast"`

**Response:**
```json
{
  "asset": {
    "id": "uuid",
    "type": "voiceover",
    "r2Key": "audio/voiceovers/uid/uuid.mp3",
    "durationMs": 12500
  },
  "signedUrl": "https://signed-r2-url...",
  "durationMs": 12500
}
```

**Ownership check:** `generatedContentId` must belong to the authenticated user (404 otherwise).

---

### `GET /api/audio/trending`

Returns the most-used audio tracks from recent reel scrapes, with trend direction.

**Auth:** `authMiddleware("user")`

**Query params:**
- `days` — lookback window (default: 7, max: 90)
- `limit` — number of results (default: 20, max: 50)
- `nicheId` — filter by niche

**Response:**
```json
{
  "audio": [
    {
      "audioId": "12345",
      "audioName": "Aesthetic",
      "artistName": "Tollan Kim",
      "useCount": 14,
      "trend": "rising"
    }
  ]
}
```

**Trend calculation:** Compares `useCount` in the current window vs the previous window of equal length:
- `rising` — current > previous
- `declining` — current < previous
- `stable` — equal

---

## Database

TTS-generated voiceovers are stored as `reel_asset` rows:

```typescript
{
  type: "voiceover",
  generatedContentId: number,
  userId: string,
  r2Key: "audio/voiceovers/{userId}/{assetId}.mp3",
  durationMs: number,
  metadata: {
    voiceId: "jessica-v1",
    speed: "normal",
    provider: "elevenlabs",
    characterCount: 850
  }
}
```

Trending audio data is derived from the `reel` table (`audioId`, `audioName`, `scrapedAt`) with a join to `trendingAudio` for artist names.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | Yes (TTS only) | ElevenLabs API authentication |

If `ELEVENLABS_API_KEY` is not set, TTS requests return 503. Trending audio still works (it queries the DB, not ElevenLabs).

---

## Cost Tracking

After each TTS generation, `recordAiCost` is called:

```typescript
await recordAiCost({
  userId,
  provider: "elevenlabs",
  featureType: "tts",
  costUsd: estimatedCost,
  durationMs: generationMs,
  metadata: { characterCount, voiceId }
});
```

---

## Related Documentation

- [Reel Generation System](./reel-generation-system.md) — How voiceovers are mixed into assembled videos
- [Music Library System](./music-library-system.md) — Background music (separate from voiceovers)

---

*Last updated: March 2026*
