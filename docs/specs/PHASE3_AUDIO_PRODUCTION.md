# Phase 3: Audio Production -- Product Specification

**Last updated:** 2026-03-14
**Status:** Not started
**Depends on:** Phase 2 (Script Generation) -- complete
**Blocks:** Phase 4 (Video Production)

---

## 1. User Journey

This is the complete step-by-step flow from "I have a script" to "I have audio ready for my reel."

### Step 1: User has a script in the Generate workspace

The user is on `/studio/generate` with a project selected and a session open. The AI has generated a script (hook + caption + shot list) via the chat. The script appears as an assistant message in the ChatPanel. Below the message bubble, the user already sees a "Send to Queue" button and a timestamp.

### Step 2: User clicks "Generate Voiceover"

A new button appears below each assistant message that has a `generatedContentId` -- right next to the existing "Send to Queue" button. The button reads "Generate Voiceover" with a microphone icon (`Mic` from lucide-react). Clicking it opens the Audio Production Panel on the right side of the workspace.

**Decision point:** The user must choose a voice before generation begins. They do NOT land on a loading state -- they land on the voice selection step.

### Step 3: Voice selection

The Audio Production Panel shows a voice picker. 3-5 preset voices are displayed as cards. Each card shows: voice name (e.g., "Aria", "Marcus", "Luna"), a short description ("Warm, conversational female voice"), and a 3-second preview button (speaker icon). The user clicks the preview button to hear a sample. Audio plays inline -- no modal, no navigation.

The user picks a voice by clicking the card. The selected card gets a highlighted border (studio-accent color).

### Step 4: Speed selection

Below the voice cards, a simple three-button toggle: "Slow", "Normal" (default, pre-selected), "Fast". These are styled as a `ButtonGroup` / segmented control using the existing `toggle-group.tsx` component.

### Step 5: User clicks "Generate"

A primary-styled "Generate Voiceover" button at the bottom of the panel. On click:

1. Button enters loading state (spinner + "Generating..." text). Button is disabled.
2. A POST request fires to `/api/audio/tts` with `{ text, voiceId, speed, generatedContentId }`.
3. The panel shows a progress indicator. Since ElevenLabs TTS for short-form content (under 60s of speech) typically takes 3-8 seconds, this is a simple indeterminate spinner -- not a progress bar.
4. On success: the Audio Player appears in the panel, replacing the generation form. The voiceover is now playable.
5. On failure: an inline error banner appears (red background, alert icon, error message, "Try Again" button). The voice/speed selections are preserved so the user does not have to re-pick.

### Step 6: User previews the voiceover

The Audio Player shows:
- Play/Pause button (large, centered)
- Waveform-style progress bar (simplified -- a styled `<input type="range">` overlaid on a decorative waveform SVG, not a real waveform. Real waveform rendering is Phase 5.)
- Current time / total duration display (e.g., "0:12 / 0:34")
- Download button (downloads the audio file directly from R2 signed URL)
- "Regenerate" button (small, secondary style) that takes the user back to Step 3 with their prior selections preserved
- "Replace Voice" link that also returns to Step 3

### Step 7: User optionally browses music

Below the voiceover player (still within the Audio Production Panel), there is a "Background Music" section with a divider line. If no music is attached, it shows:
- A music note icon (muted)
- Text: "Add background music to your reel"
- "Browse Music" button (outline style)

Clicking "Browse Music" opens the Music Library Browser as a Sheet (slide-in from the right, using the existing `sheet.tsx` component). This overlays the Audio Production Panel but does not navigate away.

### Step 8: Music Library Browser

The Sheet contains:
- A search input at the top (filters by track name, artist, mood tag)
- Filter pills below the search: mood categories ("Energetic", "Calm", "Dramatic", "Funny", "Inspiring"), duration buckets ("15s", "30s", "60s")
- A scrollable list of music tracks. Each track row shows:
  - Track name (bold)
  - Artist name (muted text, smaller)
  - Duration (e.g., "0:30")
  - Mood tag pill
  - Play/Pause button (inline, plays a preview of the track)
  - "Select" button (primary, small)

Only one track can play at a time. Starting a new preview stops the previous one.

### Step 9: User selects a music track

Clicking "Select" on a track:
1. Closes the Music Library Sheet
2. The "Background Music" section in the Audio Production Panel now shows the selected track:
   - Track name + artist
   - Play/Pause button for the music
   - "Change" button (re-opens the library)
   - "Remove" button (removes the music, returns to empty state)

### Step 10: Volume balance

Once both a voiceover and a music track are attached, a Volume Balance section appears between the voiceover player and the music section. This is a single horizontal slider (using the existing `slider.tsx` component from shadcn/ui) with:
- Left label: "Voice" with a microphone icon
- Right label: "Music" with a music note icon
- Slider range: 0 to 100, default at 70 (meaning 70% voiceover, 30% music)
- The slider value is stored as metadata on the `reel_asset` or in `generatedContent.generatedMetadata`. It is NOT applied to the audio files themselves -- it is a mixing instruction for Phase 4 assembly.

### Step 11: User is done

The Audio Production Panel now shows a complete state:
- Voiceover player (with voice name label)
- Volume balance slider
- Music track card
- A green checkmark or "Audio Ready" indicator at the top of the panel

The user can now proceed to Phase 4 (video production) or send the content to the queue. The voiceover and music track are persisted as `reel_asset` rows linked to the `generatedContentId`, so they survive page reloads and session switching.

---

## 2. Where in the UI

### Current layout (as-is)

The Generate page (`/studio/generate`) uses this structure:

```
[48px StudioTopBar]
[ProjectSidebar (w-72) | ChatArea (flex-1)]
```

The ChatArea consists of:
```
[Session header (border-b, px-5 py-3)]
[ChatPanel (flex-1 flex-col)]
  [Message scroll area (flex-1 overflow-y-auto)]
  [ChatInput (border-t, shrink-0)]
```

The ChatPanel currently occupies the full width to the right of the ProjectSidebar. There is no right panel.

### New layout (to-be)

The ChatArea splits into two zones when Audio Production is active:

```
[48px StudioTopBar]
[ProjectSidebar (w-72) | ChatArea (flex-1) | AudioPanel (w-[380px], conditional)]
```

The AudioPanel:
- Appears when the user clicks "Generate Voiceover" on any assistant message
- Is a `div` with `w-[380px] h-full border-l bg-background flex flex-col shrink-0` -- matching the ProjectSidebar's styling pattern but on the right side
- Has a close button (X icon) in its header that collapses it back, returning the chat to full width
- Is NOT a separate route. It is local component state within `ChatLayout`, controlled by a `audioContentId: number | null` state variable. When non-null, the panel renders for that generatedContentId.
- Persists across message scrolling. If the user scrolls up in the chat, the panel stays open.
- On mobile (below `md` breakpoint), the AudioPanel renders as a Sheet (full-screen slide-up) instead of an inline panel, consistent with how the ProjectSidebar collapses on mobile.

### Music Library Browser placement

The Music Library Browser opens as a `Sheet` (from `@/shared/components/ui/sheet.tsx`) sliding in from the right edge. It overlays the AudioPanel. Size: `sm:max-w-[480px]`. This uses the existing Sheet component with `side="right"`.

### "Generate Voiceover" button placement

The button appears in `ChatMessage.tsx`, inside the action row below each assistant message bubble -- the same row that currently holds the timestamp and "Send to Queue" button. The layout of that row becomes:

```
[timestamp] [Send to Queue button] [Generate Voiceover button]
```

The "Generate Voiceover" button is only visible when:
1. The message is from the assistant (`role === "assistant"`)
2. The message has a `generatedContentId` (meaning content was saved)
3. The message is NOT currently streaming (`!isSavingContent`)

### Audio status indicator in ChatMessage

Once a voiceover has been generated for a `generatedContentId`, the ChatMessage shows a small inline indicator below the action row: a green dot + "Voiceover ready" (or "Voiceover + Music ready" if music is also attached). This is fetched from a lightweight query that checks for `reel_asset` rows linked to that content ID.

---

## 3. Feature Breakdown

### 3A. TTS Voiceover Generation

**Component:** `VoiceoverGenerator`
**Location:** Rendered inside the AudioPanel when no voiceover exists yet for the selected content.

**States:**
- **Voice selection** (initial): Shows voice cards + speed toggle + "Generate" button. No audio has been created yet.
- **Generating** (loading): Voice selection is locked (greyed out). Spinner replaces the "Generate" button. Text says "Creating your voiceover..." Cancel button available (sends abort signal, deletes any partial asset).
- **Success**: VoiceoverGenerator is replaced by `VoiceoverPlayer`. The voice name and speed setting are shown as metadata labels above the player.
- **Error**: Red alert banner inline. Message varies:
  - Network error: "Could not reach the audio service. Check your connection and try again."
  - TTS provider error: "Voice generation failed. This usually resolves on retry."
  - Script too long: "Your script exceeds the maximum length for voiceover generation (5,000 characters). Shorten it and try again."
  - Rate limited: "You have reached your voiceover generation limit for this billing period." + upgrade link if not on max plan.
- **Regenerating**: Same as "Generating" but the previous voiceover player remains visible (dimmed) until the new one succeeds. If regeneration fails, the old voiceover is preserved.

**Data reads:**
- `GET /api/audio/voices` -- list of available voices with preview URLs
- `GET /api/assets?generatedContentId=X&type=voiceover` -- check if voiceover already exists

**Data writes:**
- `POST /api/audio/tts` -- creates voiceover, returns asset with signed URL

### 3B. Voice Selection UI

**Component:** `VoiceSelector`
**Location:** Inside `VoiceoverGenerator`

**Layout:** A horizontal scrollable row of voice cards (3-5 cards). Each card is 120px wide, 140px tall. On mobile the row scrolls horizontally; on desktop all cards are visible.

**Voice card contents:**
- Avatar circle at top (a colored gradient circle with initials, NOT a real photo -- we do not have voice actor photos)
- Voice name (e.g., "Aria") -- bold, 13px
- Description (e.g., "Warm, conversational") -- muted, 11px
- Gender indicator icon (optional, subtle)
- Preview button: a small circular play button in the bottom-right corner. Clicking plays a 3-second audio sample. While playing, the button shows a pause icon. Audio plays via a shared `<audio>` element managed by the `VoiceSelector` (only one preview plays at a time).

**Props:**
```typescript
interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  isLoading: boolean; // true while fetching voices
  disabled: boolean;  // true during generation
}
```

**States:**
- **Loading**: 3-5 skeleton cards (pulsing placeholder rectangles)
- **Loaded**: Voice cards displayed
- **Error fetching voices**: "Could not load voices. Retry." with retry button
- **Disabled**: All cards are visually muted, clicks do nothing (active during generation)

### 3C. Audio Preview Player

**Component:** `AudioPlayer`
**Location:** Used in two places: (1) inside AudioPanel for voiceover playback, (2) inside music track rows for track preview.

This is a reusable component. Two variants based on a `variant` prop:

**Full variant** (for voiceover in AudioPanel):
- Large play/pause button (40x40px circle, primary background)
- Progress bar (full width, styled range input with a thin track line)
- Time display: "current / total" in 11px muted text
- Download button (small icon button, right-aligned)

**Compact variant** (for music track previews in the library):
- Small play/pause button (24x24px circle, ghost style)
- No progress bar
- Duration text only (no current time)

**Props:**
```typescript
interface AudioPlayerProps {
  src: string;           // Signed URL to audio file
  duration?: number;     // Duration in seconds (from metadata)
  variant: "full" | "compact";
  onPlay?: () => void;   // Callback when playback starts
  onPause?: () => void;  // Callback when playback pauses
  className?: string;
}
```

**States:**
- **Idle**: Play button shown, progress bar at 0
- **Loading**: Play button shows spinner (audio is buffering after user clicked play)
- **Playing**: Pause button shown, progress bar advancing, time updating
- **Paused**: Play button shown, progress bar frozen at current position
- **Error**: Play button replaced with alert icon + "Playback failed" text. Can happen if the signed URL expired (in which case, re-fetch the URL).
- **Ended**: Play button shown, progress bar at 100%, time shows total/total. Next click restarts from beginning.

**Implementation notes:**
- Uses a native `<audio>` element hidden in the DOM, controlled programmatically via `useRef`
- Time updates via `requestAnimationFrame` loop while playing, not via the `timeupdate` event (which fires too infrequently for smooth progress bar movement)
- When the `src` prop changes, the player resets to idle state
- Only one AudioPlayer across the entire app should play at a time. Implement via a shared context (`AudioPlaybackContext`) that tracks the currently-playing player ID. When player A starts, it broadcasts a "stop" signal to all others.

### 3D. Music Library Browser

**Component:** `MusicLibraryBrowser`
**Location:** Rendered inside a Sheet, triggered from the AudioPanel's "Browse Music" button.

**Layout:**
```
[Sheet header: "Music Library" + close X]
[Search input (full width, with search icon)]
[Filter pills row (horizontal scroll): mood filters + duration filters]
[Divider]
[Scrollable track list]
  [MusicTrackRow]
  [MusicTrackRow]
  [MusicTrackRow]
  ...
```

**Props:**
```typescript
interface MusicLibraryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrack: (track: MusicTrack) => void;
  currentTrackId?: string; // If a track is already selected, highlight it
}
```

**States:**
- **Loading**: Skeleton rows (5 pulsing placeholder rows matching MusicTrackRow height)
- **Loaded**: Track rows displayed. If `currentTrackId` is set, that row has a checkmark icon instead of "Select" button.
- **Empty (no tracks in library)**: "No music tracks available yet. Check back soon." with a music note icon.
- **Empty (filters applied but no results)**: "No tracks match your filters." with "Clear Filters" button.
- **Error**: "Could not load the music library." with retry button.

**Data reads:**
- `GET /api/music/library?mood=energetic&duration=30&search=summer` -- paginated list of tracks

### 3E. Music Track Attachment

**Component:** `MusicAttachment`
**Location:** Inside AudioPanel, below the voiceover player section.

**Layout when empty (no track selected):**
```
[Divider line]
[Music note icon (muted, 24px)]
[Text: "Add background music to your reel"]
[Browse Music button (outline variant)]
```

**Layout when a track is selected:**
```
[Divider line]
[Track info: name + artist, small text]
[AudioPlayer compact variant for the track]
[Change button (ghost)] [Remove button (ghost, destructive text)]
```

**Props:**
```typescript
interface MusicAttachmentProps {
  generatedContentId: number;
  currentTrack: MusicTrack | null;
  onBrowse: () => void;           // Opens the MusicLibraryBrowser sheet
  onRemove: () => void;           // Detaches the track
  onTrackChange: (track: MusicTrack | null) => void;
}
```

**Data writes:**
- `POST /api/music/attach` -- `{ generatedContentId, musicTrackId }` -- creates/updates the music asset reference
- `DELETE /api/assets/:assetId` -- when removing an attached track

### 3F. Volume Balance Control

**Component:** `VolumeBalance`
**Location:** Inside AudioPanel, between the voiceover player and the music attachment section. Only visible when BOTH a voiceover and a music track are attached.

**Layout:**
```
[Mic icon] [========O================] [Music icon]
           [  Voice 70%  |  Music 30%  ]
```

**Props:**
```typescript
interface VolumeBalanceProps {
  value: number;             // 0-100, represents voiceover percentage
  onChange: (value: number) => void;
  disabled?: boolean;
}
```

**Implementation:**
- Uses the existing `Slider` component from `@/shared/components/ui/slider.tsx` (Radix UI Slider)
- Default value: 70 (voiceover takes 70% of the volume mix)
- The slider is debounced -- it fires `onChange` after 300ms of no movement, to avoid excessive API calls
- On change, fires `PATCH /api/assets/:voiceoverAssetId` with `{ metadata: { volumeBalance: value } }` to persist the setting
- The percentage labels update in real-time as the slider moves (no debounce on the display, only on the persist)

**States:**
- **Default**: Slider at 70, labels show "Voice 70% | Music 30%"
- **Adjusted**: Slider at user-chosen position
- **Saving**: Small spinner next to the slider (appears briefly, auto-hides on success)
- **Disabled**: Slider is greyed out. Happens when either voiceover or music is missing.

---

## 4. UI Components Needed

### New components to build (in `frontend/src/features/audio/`)

| Component | File | Description |
|-----------|------|-------------|
| `AudioPanel` | `components/AudioPanel.tsx` | Right-side panel container. Header with title + close button. Scrollable body. Orchestrates child components. |
| `VoiceoverGenerator` | `components/VoiceoverGenerator.tsx` | Voice selection + speed toggle + generate button. Handles the TTS generation flow. |
| `VoiceSelector` | `components/VoiceSelector.tsx` | Horizontal row of voice preview cards. |
| `VoiceCard` | `components/VoiceCard.tsx` | Individual voice card with name, description, preview button. |
| `SpeedToggle` | `components/SpeedToggle.tsx` | Three-option segmented control for speed. Wraps `ToggleGroup` from shadcn. |
| `AudioPlayer` | `components/AudioPlayer.tsx` | Reusable play/pause/progress audio player. Full and compact variants. |
| `VoiceoverPlayer` | `components/VoiceoverPlayer.tsx` | Wraps AudioPlayer (full variant) with voiceover-specific metadata display (voice name, speed, regenerate/replace actions). |
| `MusicLibraryBrowser` | `components/MusicLibraryBrowser.tsx` | Sheet-based music browsing UI with search, filters, track list. |
| `MusicTrackRow` | `components/MusicTrackRow.tsx` | Single row in the music library list. Track info + compact player + select button. |
| `MusicAttachment` | `components/MusicAttachment.tsx` | Shows attached music or empty state with browse button. |
| `VolumeBalance` | `components/VolumeBalance.tsx` | Single slider for voice/music volume ratio. |
| `AudioStatusBadge` | `components/AudioStatusBadge.tsx` | Small inline indicator for ChatMessage showing audio asset status. |

### New hooks (in `frontend/src/features/audio/hooks/`)

| Hook | File | Description |
|------|------|-------------|
| `useVoices` | `hooks/use-voices.ts` | Fetches available TTS voices via React Query. `queryKey: queryKeys.api.audioVoices()`. |
| `useGenerateVoiceover` | `hooks/use-generate-voiceover.ts` | Mutation hook for `POST /api/audio/tts`. Returns `mutateAsync`, `isPending`, `error`. Invalidates asset queries on success. |
| `useMusicLibrary` | `hooks/use-music-library.ts` | Fetches music tracks with filter/search params. Paginated. `queryKey: queryKeys.api.musicLibrary(filters)`. |
| `useAttachMusic` | `hooks/use-attach-music.ts` | Mutation hook for `POST /api/music/attach`. Invalidates asset queries on success. |
| `useContentAssets` | `hooks/use-content-assets.ts` | Fetches all `reel_asset` rows for a given `generatedContentId`. Used by AudioPanel to determine current state (no voiceover, voiceover only, voiceover + music). |
| `useAudioPlayback` | `hooks/use-audio-playback.ts` | Shared context hook for global "only one audio playing at a time" behavior. |
| `useUpdateAssetMetadata` | `hooks/use-update-asset-metadata.ts` | Mutation for PATCH on asset metadata (volume balance, etc.). Debounced. |

### New types (in `frontend/src/features/audio/types/`)

```typescript
// audio.types.ts

export interface Voice {
  id: string;
  name: string;
  description: string;
  gender: "male" | "female" | "neutral";
  previewUrl: string;        // Signed URL to a 3-second sample
  provider: string;          // e.g., "elevenlabs"
}

export type TTSSpeed = "slow" | "normal" | "fast";

export interface GenerateVoiceoverRequest {
  generatedContentId: number;
  text: string;
  voiceId: string;
  speed: TTSSpeed;
}

export interface GenerateVoiceoverResponse {
  asset: ReelAsset;
  audioUrl: string;          // Signed URL, ready to play
}

export interface MusicTrack {
  id: string;
  name: string;
  artistName: string;
  durationSeconds: number;
  mood: string;              // "energetic" | "calm" | "dramatic" | "funny" | "inspiring"
  genre?: string;
  previewUrl: string;        // Signed URL for preview playback
  isSystemTrack: boolean;    // Always true for v1 (admin-uploaded)
}

export interface MusicLibraryFilters {
  search?: string;
  mood?: string;
  durationBucket?: "15" | "30" | "60";
  page?: number;
  limit?: number;
}

export interface MusicLibraryResponse {
  tracks: MusicTrack[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface AttachMusicRequest {
  generatedContentId: number;
  musicTrackId: string;
}

export interface ReelAsset {
  id: string;
  generatedContentId: number;
  userId: string;
  type: "voiceover" | "music" | "video_clip" | "image";
  r2Key: string;
  r2Url: string;
  durationMs: number;
  metadata: Record<string, unknown>;  // volumeBalance, voiceId, speed, etc.
  createdAt: string;
}
```

### New context (in `frontend/src/features/audio/contexts/`)

```typescript
// AudioPlaybackContext.tsx

interface AudioPlaybackContextValue {
  currentPlayerId: string | null;
  play: (playerId: string) => void;
  stop: () => void;
}
```

Wrap the Generate page (or the entire Studio layout) with `<AudioPlaybackProvider>`. Each `AudioPlayer` instance registers a unique ID and checks `currentPlayerId` to know whether it should be playing.

### Modifications to existing components

| Component | Change |
|-----------|--------|
| `ChatLayout.tsx` | Add `audioContentId` state. Render `AudioPanel` conditionally on the right side. Pass `onOpenAudio` callback down to ChatPanel. |
| `ChatPanel.tsx` | Accept and forward `onOpenAudio` callback to ChatMessage instances. |
| `ChatMessage.tsx` | Add "Generate Voiceover" button in the action row. Add `AudioStatusBadge` below the action row when assets exist. Accept `onOpenAudio: (contentId: number) => void` prop. |
| `queryKeys` (`@/shared/lib/query-keys`) | Add keys: `audioVoices`, `musicLibrary`, `contentAssets`. |

---

## 5. API Contracts

### 5.1 GET /api/audio/voices

Returns the list of available TTS voices.

**Authentication:** Required (Firebase token via `requireAuth` middleware).

**Query parameters:** None.

**Response 200:**
```json
{
  "voices": [
    {
      "id": "aria-v1",
      "name": "Aria",
      "description": "Warm, conversational female voice. Great for lifestyle and wellness content.",
      "gender": "female",
      "previewUrl": "https://r2.example.com/voices/aria-preview.mp3?sig=...",
      "provider": "elevenlabs"
    },
    {
      "id": "marcus-v1",
      "name": "Marcus",
      "description": "Deep, authoritative male voice. Works well for educational and business content.",
      "gender": "male",
      "previewUrl": "https://r2.example.com/voices/marcus-preview.mp3?sig=...",
      "provider": "elevenlabs"
    }
  ]
}
```

**Response 401:** Unauthorized.

**Implementation notes:**
- Voices are hardcoded in a config file on the backend, NOT stored in the database. Adding a new voice means adding a config entry and uploading a preview file to R2.
- The `previewUrl` is a signed R2 URL generated on each request (1-hour expiry).
- The `id` maps to an ElevenLabs voice ID internally, but the frontend never sees the provider-specific ID.

### 5.2 POST /api/audio/tts

Generates a voiceover from script text.

**Authentication:** Required.

**Rate limiting:** Subject to `usageGate` middleware. Feature type: `voiceover_generation`. Limits per tier:
- Free: 5/month
- Creator: 30/month
- Pro: 100/month
- Agency: 500/month

**Request body:**
```json
{
  "generatedContentId": 42,
  "text": "Have you ever noticed how the best creators never actually...",
  "voiceId": "aria-v1",
  "speed": "normal"
}
```

**Validation rules:**
- `generatedContentId`: Required. Integer. Must belong to the authenticated user.
- `text`: Required. String. Min 1 character, max 5000 characters. Stripped of markdown formatting before sending to TTS provider.
- `voiceId`: Required. Must match one of the configured voice IDs.
- `speed`: Required. One of `"slow"`, `"normal"`, `"fast"`.

**Response 200:**
```json
{
  "asset": {
    "id": "asset_abc123",
    "generatedContentId": 42,
    "userId": "user_xyz",
    "type": "voiceover",
    "r2Key": "audio/voiceovers/user_xyz/asset_abc123.mp3",
    "r2Url": "https://r2.example.com/audio/voiceovers/user_xyz/asset_abc123.mp3",
    "durationMs": 34200,
    "metadata": {
      "voiceId": "aria-v1",
      "voiceName": "Aria",
      "speed": "normal",
      "provider": "elevenlabs",
      "characterCount": 245,
      "volumeBalance": 70
    },
    "createdAt": "2026-03-14T12:00:00.000Z"
  },
  "audioUrl": "https://r2.example.com/audio/voiceovers/...?sig=...&exp=3600"
}
```

**Response 400:** Validation error (text too long, invalid voiceId, etc.)
```json
{
  "error": "TEXT_TOO_LONG",
  "message": "Script text exceeds the maximum of 5000 characters.",
  "maxCharacters": 5000,
  "actualCharacters": 5234
}
```

**Response 403:** Usage limit reached.
```json
{
  "error": "USAGE_LIMIT_REACHED",
  "message": "You have reached your voiceover generation limit for this billing period.",
  "feature": "voiceover_generation",
  "used": 30,
  "limit": 30
}
```

**Response 502:** TTS provider failure.
```json
{
  "error": "TTS_PROVIDER_ERROR",
  "message": "Voice generation failed. Please try again."
}
```

**Backend flow:**
1. Validate request and check usage limits.
2. Strip markdown from `text` (remove `**`, `#`, `- `, etc.). Keep punctuation for natural TTS pacing.
3. Map `voiceId` to the ElevenLabs-specific voice ID.
4. Map `speed` to ElevenLabs stability/speed parameters (`slow` = 0.8x, `normal` = 1.0x, `fast` = 1.2x).
5. Call ElevenLabs TTS API. Receive audio buffer (mp3).
6. Calculate audio duration from the buffer (use a lightweight mp3 header parser or ElevenLabs response metadata).
7. Upload audio buffer to R2 at path `audio/voiceovers/{userId}/{assetId}.mp3`.
8. Insert `reel_asset` row.
9. Record cost in `ai_cost_ledger` with `featureType: "tts"`, storing character count and estimated cost.
10. Increment usage counter for `voiceover_generation`.
11. Generate signed URL for the uploaded file.
12. Return asset + signed URL.

**If a voiceover already exists for this generatedContentId:**
- The old `reel_asset` row is soft-deleted (or hard-deleted -- TBD, but the old R2 file is deleted to avoid storage bloat).
- The new voiceover replaces it.
- This means "Regenerate" does not create version stacks. There is one voiceover per content at a time.

### 5.3 GET /api/music/library

Returns paginated music tracks for the user-facing library.

**Authentication:** Required.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | (none) | Full-text search on track name and artist |
| `mood` | string | (none) | Filter by mood. One of: `energetic`, `calm`, `dramatic`, `funny`, `inspiring` |
| `durationBucket` | string | (none) | Filter by approximate duration: `15`, `30`, `60` |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page, max 50 |

**Response 200:**
```json
{
  "tracks": [
    {
      "id": "track_001",
      "name": "Sunset Drive",
      "artistName": "Audio Library",
      "durationSeconds": 30,
      "mood": "calm",
      "genre": "lo-fi",
      "previewUrl": "https://r2.example.com/music/track_001.mp3?sig=...",
      "isSystemTrack": true
    }
  ],
  "total": 48,
  "page": 1,
  "hasMore": true
}
```

**Response 401:** Unauthorized.

**Implementation notes:**
- Music tracks are stored in a new `music_track` table (admin-managed). Fields: `id`, `name`, `artistName`, `durationSeconds`, `mood`, `genre`, `r2Key`, `isActive`, `createdAt`.
- The `previewUrl` is the full track audio (not a clip). For v1, we serve the complete file. Tracks are short (15-60s) so this is acceptable.
- Duration bucket filtering: `15` matches 0-20s, `30` matches 21-45s, `60` matches 46-90s.
- Search uses PostgreSQL `ILIKE` on `name` and `artistName` columns. No full-text indexing for v1.

### 5.4 POST /api/music/attach

Attaches a music track to a piece of generated content.

**Authentication:** Required.

**Request body:**
```json
{
  "generatedContentId": 42,
  "musicTrackId": "track_001"
}
```

**Validation rules:**
- `generatedContentId`: Required. Integer. Must belong to the authenticated user.
- `musicTrackId`: Required. Must reference an existing, active music track.

**Response 200:**
```json
{
  "asset": {
    "id": "asset_def456",
    "generatedContentId": 42,
    "userId": "user_xyz",
    "type": "music",
    "r2Key": "music/track_001.mp3",
    "r2Url": "https://r2.example.com/music/track_001.mp3",
    "durationMs": 30000,
    "metadata": {
      "musicTrackId": "track_001",
      "trackName": "Sunset Drive",
      "artistName": "Audio Library",
      "mood": "calm"
    },
    "createdAt": "2026-03-14T12:05:00.000Z"
  }
}
```

**Response 400:** Invalid content ID or track ID.
**Response 404:** Content or track not found.

**Backend flow:**
1. Validate that `generatedContentId` belongs to the user.
2. Validate that `musicTrackId` exists and `isActive = true`.
3. Check if a music asset already exists for this content. If yes, delete the old `reel_asset` row (but NOT the R2 file -- music tracks are shared, not duplicated per user).
4. Create a new `reel_asset` row with `type: "music"`. The `r2Key` points to the shared music track file (not a user-specific copy).
5. Return the new asset.

**Important:** Music tracks are NOT copied per user. The `reel_asset` row references the same R2 key as the `music_track` table row. This saves storage. During Phase 4 assembly, the render service reads from the shared R2 key.

### 5.5 GET /api/assets (supporting endpoint)

Returns assets for a given content ID.

**Authentication:** Required.

**Query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `generatedContentId` | number | Required. Filter by content. |
| `type` | string | Optional. Filter by type (`voiceover`, `music`, etc.) |

**Response 200:**
```json
{
  "assets": [
    {
      "id": "asset_abc123",
      "generatedContentId": 42,
      "type": "voiceover",
      "r2Key": "...",
      "durationMs": 34200,
      "metadata": { "voiceId": "aria-v1", "speed": "normal", "volumeBalance": 70 },
      "createdAt": "..."
    },
    {
      "id": "asset_def456",
      "generatedContentId": 42,
      "type": "music",
      "r2Key": "...",
      "durationMs": 30000,
      "metadata": { "musicTrackId": "track_001", "trackName": "Sunset Drive" },
      "createdAt": "..."
    }
  ]
}
```

### 5.6 PATCH /api/assets/:id (supporting endpoint)

Updates asset metadata (used for volume balance changes).

**Authentication:** Required. Asset must belong to the authenticated user.

**Request body:**
```json
{
  "metadata": {
    "volumeBalance": 65
  }
}
```

**Response 200:** Updated asset object.

### 5.7 DELETE /api/assets/:id (supporting endpoint)

Deletes an asset. Used when removing a music attachment or when regenerating a voiceover (old one is deleted).

**Authentication:** Required. Asset must belong to the authenticated user.

**Response 204:** No content.

**Backend flow:**
- If asset type is `voiceover`: delete the R2 file AND the database row.
- If asset type is `music`: delete ONLY the database row (R2 file is shared).

---

## 6. Edge Cases & Error States

### TTS Generation

| Scenario | Behavior |
|----------|----------|
| **Script is empty** | "Generate Voiceover" button is disabled with a tooltip: "Write or generate a script first." |
| **Script exceeds 5000 characters** | Validation error shown inline before the request is sent (client-side check). Message: "Your script is too long for voiceover generation. Maximum: 5,000 characters. Current: X,XXX characters." |
| **TTS provider is down** | 502 error. Show: "Voice generation is temporarily unavailable. Our team has been notified. Try again in a few minutes." Retry button available. |
| **TTS provider returns garbled/silent audio** | No automated detection in v1. User must listen and regenerate if quality is bad. Future improvement: automated silence detection. |
| **User closes AudioPanel mid-generation** | Generation continues in the background. When the user re-opens the panel for that content, the completed voiceover is shown (fetched via `useContentAssets`). If generation failed while panel was closed, re-opening shows the voice selection state with no error (the error is transient). |
| **User navigates away from Generate tab mid-generation** | Same as closing panel. The backend request completes independently. Asset is saved if successful. |
| **User switches to a different session mid-generation** | The AudioPanel closes (it is tied to the content ID from the previous session). If they return, they see the result. |
| **Concurrent generations for the same content** | The backend uses an idempotency check. If a TTS generation is already in-progress for a given `generatedContentId`, the second request returns 409 Conflict with message: "A voiceover is already being generated for this content." |
| **User is offline** | Fetch fails. Standard network error: "No internet connection. Check your network and try again." |
| **Usage limit reached** | 403 response. AudioPanel shows the limit-hit UI (same pattern as the existing `LimitHitModal` but inline in the panel): limit message + upgrade link (or "max plan" badge). |
| **Markdown in script text** | Backend strips markdown before sending to TTS. The user does not need to worry about this. Stripping removes: `#`, `**`, `*`, `` ` ``, `- `, `> `, `---`, `|`, link syntax. Keeps periods, commas, question marks, exclamation points, newlines (converted to pauses). |

### Music Library

| Scenario | Behavior |
|----------|----------|
| **No music tracks exist** | Empty state: music note icon + "No music tracks available yet. Our team is adding new tracks regularly." No "retry" because this is a content gap, not a technical error. |
| **Search returns no results** | "No tracks match your search." + "Clear Search" button that resets the search input and filters. |
| **Music file fails to load/play** | Compact AudioPlayer shows error state. "Preview unavailable" text replaces the play button. Track is still selectable (the file might play fine in assembly, the preview CDN might just be slow). |
| **Admin deletes a track that is already attached to user content** | The `reel_asset` row references a dead R2 key. When the AudioPanel loads and tries to generate a signed URL, it fails. The music section shows: "This track is no longer available." + "Choose a different track" button. Backend should mark orphaned music assets with a flag on next access. |
| **User attaches a track, then the admin deactivates it** | Same as above. The `isActive` flag on the `music_track` table means it will not appear in library searches, but existing attachments remain until the user replaces them or the backend detects the inactive state. |

### Volume Balance

| Scenario | Behavior |
|----------|----------|
| **Only voiceover, no music** | Volume balance slider is hidden. No point showing it. |
| **Only music, no voiceover** | This state should not be possible in the normal flow (you generate voiceover first, then add music). But if it occurs (e.g., voiceover asset was deleted), the slider is hidden. |
| **Slider save fails** | Silent failure. The slider visually stays at the user's position. A small warning icon appears next to the slider for 3 seconds, then fades. The value will attempt to save again on next change. |
| **User changes volume balance rapidly** | Debounced at 300ms. Only the final position is saved. No intermediate API calls. |

### General

| Scenario | Behavior |
|----------|----------|
| **Signed URLs expire** | R2 signed URLs have 1-hour expiry. If the user leaves the tab open for >1 hour, audio playback will fail when they press play. The AudioPlayer detects the 403/error and shows: "Session expired. Refreshing..." + auto-refetches the asset to get a new signed URL. |
| **Multiple browser tabs** | No cross-tab sync in v1. If the user generates a voiceover in Tab A, Tab B will not update until the next query refetch. TanStack Query's stale time handles this on focus. |
| **Mobile layout** | AudioPanel becomes a bottom sheet (slide-up) instead of a side panel. The Music Library Browser also becomes a full-screen sheet. All functionality is identical, just full-width. |

---

## 7. Empty States

### AudioPanel (first open, no assets)

When a user clicks "Generate Voiceover" for the first time on a piece of content, the AudioPanel opens with:

```
[Panel header: "Audio" + close X]

[Microphone icon (48px, muted, centered)]
[Heading: "Create your voiceover"]
[Subtext: "Choose a voice and generate audio from your script."]

[VoiceSelector component]
[SpeedToggle component]
[Generate button]

[Divider]

[Music note icon (muted, small)]
[Text: "You can add background music after generating your voiceover."]
[Browse Music button (disabled, with tooltip: "Generate a voiceover first")]
```

The "Browse Music" button is intentionally disabled until a voiceover exists. Rationale: the volume balance feature requires both tracks. Allowing music-only attachment creates an incomplete state that confuses the Phase 4 assembly pipeline. If a user genuinely wants background-music-only content (no voiceover), that is a Phase 4 concern where they can skip voiceover in the storyboard.

### AudioPanel (voiceover exists, no music)

```
[Panel header: "Audio" + close X]

[VoiceoverPlayer with play/pause/progress/download/regenerate]
[Voice label: "Aria - Normal speed"]

[Divider]

[Music note icon (muted)]
[Text: "Add background music to your reel"]
[Browse Music button (enabled, outline style)]
```

### AudioPanel (voiceover + music attached)

```
[Panel header: "Audio" + green checkmark + "Ready"]

[VoiceoverPlayer]
[Voice label]

[VolumeBalance slider]

[Music track card: name + artist + compact player + change/remove buttons]
```

### Music Library Browser (empty library)

```
[Sheet header: "Music Library" + close X]

[Search input (disabled)]
[Filter pills (disabled)]

[Centered empty state:]
  [Music note icon (64px, very muted)]
  [Heading: "No music available"]
  [Subtext: "Our team is curating royalty-free tracks. Check back soon."]
```

### ChatMessage (no audio assets yet)

No change from current behavior. The "Generate Voiceover" button is the entry point. There is no empty-state badge -- the absence of audio is the default. The `AudioStatusBadge` only appears AFTER a voiceover has been generated.

### ChatMessage (audio exists)

Below the action row (timestamp + Send to Queue + Generate Voiceover):

```
[Green dot] Voiceover ready
```

or

```
[Green dot] Voiceover + Music ready
```

Clicking this badge re-opens the AudioPanel for that content ID, showing the existing assets.

---

## 8. Database Schema Changes

### New table: `reel_asset`

```sql
CREATE TABLE reel_asset (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_content_id INTEGER NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voiceover', 'music', 'video_clip', 'image')),
  r2_key TEXT NOT NULL,
  r2_url TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX reel_asset_content_idx ON reel_asset(generated_content_id);
CREATE INDEX reel_asset_user_idx ON reel_asset(user_id);
CREATE INDEX reel_asset_type_idx ON reel_asset(generated_content_id, type);
```

### New table: `music_track`

```sql
CREATE TABLE music_track (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist_name TEXT,
  duration_seconds INTEGER NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('energetic', 'calm', 'dramatic', 'funny', 'inspiring')),
  genre TEXT,
  r2_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by TEXT,  -- admin user ID
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX music_track_mood_idx ON music_track(mood) WHERE is_active = true;
CREATE INDEX music_track_active_idx ON music_track(is_active);
```

### Modification: `ai_cost_ledger`

Add new `feature_type` values: `"tts"` and `"music_gen"` (the latter is for the stretch goal).

The existing `ai_cost_ledger` table tracks token-based costs. For TTS, costs are character-based. Add a `cost_usd` column (DECIMAL) to store the flat USD cost directly, alongside the existing token columns (which can be null for non-LLM features).

---

## 9. Admin Requirements

### Music Track Management

Admins need a UI to upload and manage music tracks. This should be a new section in the existing admin portal at `/admin/`.

**Minimal admin UI:**
- A table listing all music tracks (name, artist, mood, duration, active status, upload date)
- "Upload Track" button that opens a form: file picker (mp3 only, max 10MB), name, artist, mood dropdown, genre input
- Toggle active/inactive per track
- Delete track (with confirmation: "This will remove the track from the library. Existing user attachments will show 'track unavailable'.")

This admin UI is a prerequisite for the user-facing music library. Without tracks uploaded, the library is empty. Plan for the admin upload flow to be built and used to seed 20-30 tracks BEFORE the user-facing music browser ships.

---

## 10. Cost Tracking

### ElevenLabs TTS Pricing (as of 2026-03)

- Standard voices: ~$0.30 per 1,000 characters
- For a typical 30-second reel script (~500 characters): ~$0.15 per voiceover

### Cost recording

Every TTS generation writes to `ai_cost_ledger`:
```json
{
  "userId": "user_xyz",
  "featureType": "tts",
  "provider": "elevenlabs",
  "model": "eleven_multilingual_v2",
  "costUsd": 0.15,
  "metadata": {
    "characterCount": 487,
    "voiceId": "aria-v1",
    "durationMs": 34200
  }
}
```

### Usage limits by tier

| Tier | Voiceovers / month |
|------|-------------------|
| Free | 5 |
| Creator | 30 |
| Pro | 100 |
| Agency | 500 |

These limits are enforced by the existing `usageGate` middleware pattern. Add a new feature key `voiceover_generation` to the tier config.

---

## 11. Implementation Order

This section maps to the sprint plan in `REEL_CREATION_TODO.md` but adds specificity.

### Week 1: Infrastructure

1. `reel_asset` table migration (Drizzle schema + migration file)
2. `music_track` table migration
3. Asset CRUD API routes (`/api/assets` GET, PATCH, DELETE)
4. `ai_cost_ledger` schema update (add `cost_usd` column, add `tts` feature type)
5. Cost tracking helper: `recordMediaCost()` function

### Week 2: TTS Integration + Core UI

6. ElevenLabs provider service (abstracted behind `TTSProvider` interface)
7. `POST /api/audio/tts` endpoint (full flow: validate, generate, upload, track cost)
8. `GET /api/audio/voices` endpoint
9. `AudioPanel` component (container only)
10. `VoiceSelector` + `VoiceCard` components
11. `SpeedToggle` component
12. `VoiceoverGenerator` component (wires selection to API)
13. `AudioPlayer` component (both variants)
14. `VoiceoverPlayer` component
15. `AudioPlaybackContext`
16. Wire into `ChatLayout` (add right panel state, "Generate Voiceover" button in ChatMessage)

### Week 3: Music Library

17. Admin music upload UI (admin portal section)
18. Seed 20-30 royalty-free tracks via admin UI
19. `GET /api/music/library` endpoint
20. `POST /api/music/attach` endpoint
21. `MusicLibraryBrowser` component (Sheet, search, filters)
22. `MusicTrackRow` component
23. `MusicAttachment` component
24. `VolumeBalance` component
25. `AudioStatusBadge` component in ChatMessage
26. Integration testing of the full flow

---

## 12. What Is Explicitly NOT in This Spec

- Audio waveform visualization (real waveforms from audio data). Phase 5.
- Audio trimming or editing. Phase 5.
- Audio effects (reverb, EQ, compression). Not planned.
- Custom voice cloning. Not planned.
- AI music generation (Suno/Udio). Stretch goal, not in v1.
- Audio-to-text transcription / auto-captions. Phase 5.
- Voiceover versioning (keeping multiple voiceovers per content). One at a time.
- Multi-language TTS. English only for v1.
- Audio file format options (always mp3).
- Audio quality settings (always highest quality from provider).
- Batch voiceover generation (multiple scripts at once). Not planned.
