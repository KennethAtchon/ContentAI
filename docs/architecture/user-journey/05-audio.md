# Audio & Voiceover Journey

**Entry:** Content Workspace in `/studio/generate` → "Open Audio", or Queue detail panel
**Auth:** Required

---

## Overview

After content is generated, users can add audio to it:
1. **Voiceover** — AI-generated text-to-speech from the content script
2. **Background music** — selected from the curated music library
3. **Volume balancing** — adjust relative levels of voiceover vs music

---

## What the User Sees

- **VoiceSelector** — browse available TTS voices with name, gender, preview playback
- **VoiceoverPlayer** — waveform visualization + playback controls after generation
- **MusicAttachment** — music library browser with preview
- **VolumeBalance** — slider UI for voiceover vs music levels
- **SpeedToggle** — adjust TTS playback speed

---

## Journey: Generate a Voiceover

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant TTS as TTS Service
    participant R2 as Cloudflare R2
    participant DB as PostgreSQL

    U->>FE: Click "Open Audio" on a content item in Workspace
    FE->>BE: GET /api/audio/voices
    BE-->>FE: [{ id, name, gender, previewUrl }]
    FE->>FE: Render VoiceSelector with voice cards

    U->>FE: Click preview on a voice card
    FE->>FE: Play previewUrl audio in browser

    U->>FE: Select preferred voice
    U->>FE: Click "Generate Voiceover"
    FE->>BE: POST /api/audio/generate-voiceover { contentId, voiceId }
    BE->>TTS: Generate TTS from content script
    TTS-->>BE: Audio file (MP3/WAV)
    BE->>R2: Upload audio file
    R2-->>BE: { url: "https://r2.../voiceover-<id>.mp3" }
    BE->>DB: INSERT INTO content_assets { content_id, role: "voiceover", url }
    BE-->>FE: { url, assetId }
    FE->>FE: Render VoiceoverPlayer with waveform
    U->>FE: Play/pause/scrub voiceover
```

---

## Journey: Attach Background Music

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click "Add Music" in audio workspace
    FE->>BE: GET /api/music
    BE->>DB: SELECT * FROM music_tracks WHERE active=true
    DB-->>BE: [{ id, name, artist, mood, genre, previewUrl }]
    BE-->>FE: Music tracks
    FE->>FE: Render MusicAttachment browser (filterable by mood/genre)

    U->>FE: Click preview on a track
    FE->>FE: Play previewUrl in browser

    U->>FE: Select a track → Confirm
    FE->>BE: POST /api/audio/attach-music { contentId, trackId }
    BE->>DB: INSERT INTO content_assets { content_id, role: "music", track_id }
    BE-->>FE: { assetId }
    FE->>FE: Show selected track in audio workspace
```

---

## Journey: Balance Volume Levels

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    Note over FE: VolumeBalance component visible after both voiceover + music attached
    U->>FE: Adjust voiceover/music balance slider
    FE->>FE: Real-time audio preview updates
    U->>FE: Click "Save"
    FE->>BE: PATCH /api/audio/balance { contentId, voiceoverVolume: 0.8, musicVolume: 0.4 }
    BE->>DB: UPDATE content_assets SET volume=... WHERE content_id=:id
    BE-->>FE: { success: true }
    FE->>FE: Show "Saved" confirmation
```

---

## Journey: Adjust TTS Speed

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Click SpeedToggle (options: 0.75x, 1x, 1.25x, 1.5x)
    FE->>BE: POST /api/audio/generate-voiceover { contentId, voiceId, speed: 1.25 }
    Note over BE: Re-generates the voiceover at new speed, replaces asset
    BE-->>FE: { url: new_voiceover_url }
    FE->>FE: VoiceoverPlayer loads new audio
```

---

## Audio Asset Structure

Each content item can have multiple `content_asset` rows:

| Role | Description |
|---|---|
| `voiceover` | AI-generated TTS audio uploaded to R2 |
| `music` | Reference to a `music_track` row |
| `video_clip` | Video clips for the editor |

---

## Key Components

| Component | Purpose |
|---|---|
| `AudioPlayer` | Base audio playback component |
| `VoiceSelector` | Browse and preview TTS voices |
| `VoiceoverPlayer` | Waveform + controls for generated voiceover |
| `MusicAttachment` | Music library browser |
| `VolumeBalance` | Voiceover vs music level slider |
| `SpeedToggle` | TTS playback speed selector |
