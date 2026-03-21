# 02 -- Caption System

**Priority:** Phase 3 (after Editor Core)
**Effort:** Large (3-4 weeks)
**Dependencies:** Editor Core (Phase 2), specifically the text track and 9:16 preview

---

## User Problem

Captions are the single most important element of a viral reel. Every major reel creator adds word-by-word animated captions -- the kind CapCut auto-generates. ContentAI already has the script (from generation) and the voiceover audio (from TTS). But there is no way to turn those into timed, styled captions on the video. Creators currently have to export from ContentAI and then open CapCut just to add captions, which defeats the purpose of an all-in-one platform.

---

## User Stories

- As a creator, I want to auto-generate word-level captions from my voiceover audio so that I do not have to manually type and time every word.
- As a creator, I want to choose a caption style (font, color, animation, position) from presets like CapCut offers so that my captions look professional without design effort.
- As a creator, I want to edit individual caption words (text, timing, style) so that I can fix transcription errors or adjust emphasis.
- As a creator, I want to preview captions on the video in real-time so that I can see exactly how they will look before exporting.
- As a creator, I want captions to be rendered into my final exported video so that the video I download is ready to post.

---

## How CapCut Does It

CapCut's auto-caption workflow:

1. User clicks "Auto captions" button
2. CapCut sends the audio track to a speech-to-text service
3. Returns word-level timestamps (each word has a start time and end time in ms)
4. Captions are placed on a dedicated caption track
5. User picks a style preset (font, size, color, background, animation, position)
6. Captions render on the preview in real-time
7. Export burns the captions into the video via ffmpeg `drawtext` or ASS subtitle rendering

**Style presets CapCut offers:**
- Plain white text (centered, bottom third)
- Bold with black outline
- Colored background box behind text
- Word-by-word highlight (current word changes color)
- Pop-in animation (scale from 0 to 1 per word)
- Typewriter animation (characters appear left to right)
- Karaoke style (text slides in, active word highlighted)

---

## Implementation Plan

### Step 1: Word-Level Transcription (Backend)

**The input:** A voiceover audio file already stored in R2 (the TTS pipeline creates these).

**The service:** Use OpenAI Whisper API (`/v1/audio/transcriptions` with `response_format=verbose_json` and `timestamp_granularities=word`). This returns:

```json
{
  "text": "Three things nobody tells you about investing",
  "words": [
    { "word": "Three", "start": 0.0, "end": 0.32 },
    { "word": "things", "start": 0.34, "end": 0.62 },
    { "word": "nobody", "start": 0.64, "end": 0.98 },
    ...
  ]
}
```

**Why Whisper over alternatives:**
- OpenAI Whisper is the most accurate for English speech-to-text with word-level timestamps
- Supports 50+ languages (future internationalization)
- 25MB file size limit covers any reel voiceover (max ~3 minutes = ~5MB for MP3)
- Cost: $0.006/minute. A 60-second voiceover costs $0.006. Negligible.
- Alternatives: Deepgram (similar quality, slightly cheaper), AssemblyAI (good but more expensive). Whisper is the safe default because the backend already uses OpenAI for other things.

**Alternative for TTS-generated audio:** Since ContentAI generates voiceovers via TTS, the script text and word timing might be extractable from the TTS provider directly (some TTS APIs like ElevenLabs return word timestamps). This would skip the Whisper call entirely. Check whether the existing TTS provider returns timestamps in its response. If it does, store them with the asset metadata and use them directly.

**New endpoint:**

```
POST /api/captions/transcribe
Body: { assetId: string }
Response: { captionId: string, words: Array<{ word: string, start: number, end: number }> }
```

**Flow:**
1. Resolve asset by ID, verify ownership, get R2 key
2. Download audio from R2 to temp file
3. Send to Whisper API
4. Save result to a new `captions` table
5. Return word-level data

**New table: `captions`**

```sql
CREATE TABLE captions (
  id          TEXT PRIMARY KEY DEFAULT gen_ulid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT 'en',
  words       JSONB NOT NULL,  -- Array of { word, start, end }
  full_text   TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX captions_asset_idx ON captions(asset_id);
CREATE INDEX captions_user_idx ON captions(user_id);
```

### Step 2: Caption Track Model (Frontend)

Captions are a special type of content on the text track. But they are different from free-form text overlays: they are a sequence of timed words that display as groups.

**Data model extension:**

Add to the `Clip` type:

```typescript
// Existing text fields
textContent?: string;
textStyle?: TextStyle;

// New caption fields
captionId?: string;           // Reference to captions table
captionWords?: CaptionWord[]; // Inline word data for the clip
captionStylePreset?: string;  // e.g., "bold-outline", "highlight", "pop-in"
captionGroupSize?: number;    // Words per group (default 3)
```

```typescript
interface CaptionWord {
  word: string;
  startMs: number;  // Relative to clip start
  endMs: number;    // Relative to clip start
  edited?: boolean; // User manually edited this word
}
```

**How captions map to clips:**

When the user auto-generates captions, the system creates a single caption clip on the text track that spans the duration of the voiceover. The clip contains all words. The rendering logic handles displaying the right words at the right time.

This is simpler than creating one clip per word or per phrase. One clip = one caption track segment = one style applied to all words. If the user wants different styles for different sections, they can split the caption clip (using the existing split clip feature from Phase 2).

### Step 3: Caption Style Presets

**MVP presets (6 styles):**

| Preset ID | Name | Description |
|-----------|------|-------------|
| `clean-white` | Clean White | White text, centered, bottom 20%, no background, Inter Bold, 48px |
| `bold-outline` | Bold Outline | White text, 3px black outline, centered, bottom 20%, Inter Black, 56px |
| `box-dark` | Dark Box | White text on semi-transparent black rounded rectangle, bottom 20% |
| `box-accent` | Accent Box | Dark text on brand-colored rounded rectangle, bottom 20% |
| `highlight` | Word Highlight | White text, current word highlighted in yellow, bottom 20% |
| `karaoke` | Karaoke | All words visible in dim white, current word bright white + larger, bottom 20% |

**Preset data structure:**

```typescript
interface CaptionPreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  activeColor?: string;      // For highlight/karaoke styles
  outlineColor?: string;
  outlineWidth?: number;
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundRadius?: number;
  positionY: number;         // Percentage from top (e.g., 80 = bottom 20%)
  animation: "none" | "pop-in" | "typewriter" | "highlight" | "karaoke";
  groupSize: number;         // Words per visible group
}
```

### Step 4: Real-Time Caption Preview (Frontend)

**Rendering approach:** Canvas overlay on top of the video preview.

The PreviewArea already has stacked `<video>` elements. Add a `<canvas>` element layered on top (same dimensions, `position: absolute`) that draws the active caption words.

**On each frame (tied to `requestAnimationFrame` playback loop):**
1. Find the caption clip(s) active at `currentTimeMs`
2. Determine which word group is active (based on word timestamps and `groupSize`)
3. Draw the group using the selected preset's font, color, position, and animation

**Canvas drawing for each preset:**

```typescript
function drawCaptions(
  ctx: CanvasRenderingContext2D,
  words: CaptionWord[],
  currentTimeMs: number,
  preset: CaptionPreset,
  canvasWidth: number,
  canvasHeight: number
) {
  // Find active group
  const groupSize = preset.groupSize;
  const activeWordIndex = words.findIndex(
    (w) => currentTimeMs >= w.startMs && currentTimeMs < w.endMs
  );
  if (activeWordIndex === -1) return;

  const groupStart = Math.floor(activeWordIndex / groupSize) * groupSize;
  const groupWords = words.slice(groupStart, groupStart + groupSize);

  const y = canvasHeight * (preset.positionY / 100);

  // Draw background if applicable
  if (preset.backgroundColor) {
    // Measure text width, draw rounded rect
  }

  // Draw each word
  let x = canvasWidth / 2; // centered
  for (const word of groupWords) {
    const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
    ctx.fillStyle = isActive && preset.activeColor ? preset.activeColor : preset.color;
    ctx.font = `${preset.fontWeight} ${preset.fontSize}px ${preset.fontFamily}`;
    // Draw with outline if applicable
    ctx.fillText(word.word, x, y);
    x += ctx.measureText(word.word + " ").width;
  }
}
```

**Limitations of canvas preview:**
- Font rendering on canvas is less crisp than DOM text. For preview this is acceptable.
- Animations (pop-in, typewriter) need per-frame interpolation. Keep it simple: pop-in is a scale tween from 0.5 to 1.0 over 100ms. Typewriter is a clip-rect that reveals characters over the word's duration.

### Step 5: Caption Editing UI

**In the Inspector (when a caption clip is selected):**

Add a new "Captions" section (collapse/expand):

1. **Style preset picker** -- grid of 6 preset thumbnails. Click to apply.
2. **Group size** -- dropdown: 1 word, 2 words, 3 words (default), 4 words, full line
3. **Font size override** -- slider (24-96px)
4. **Position** -- vertical position slider (top/middle/bottom)
5. **Word list** -- scrollable list of all words with start/end times
   - Click a word to jump playhead to that timestamp
   - Double-click to edit the word text
   - Drag word edges to adjust timing (stretch/shrink)

**In the Timeline:**
- Caption clips render as a series of thin vertical marks at each word boundary
- The currently active word group is highlighted

### Step 6: Caption Export (Backend)

**Two approaches for burning captions into the exported video:**

**Option A: ASS/SSA subtitle rendering via ffmpeg `ass` filter**
- Generate an ASS subtitle file from the caption data
- ASS supports styled text, colors, outlines, positioning, and basic animations
- Pass to ffmpeg: `-vf "ass=captions.ass"`
- Pros: Rich styling, well-supported, handles text rendering properly
- Cons: ASS animation syntax is arcane. Pop-in and karaoke effects require ASS override tags.

**Option B: ffmpeg `drawtext` filter (current approach)**
- Already used for text overlays in the export pipeline
- Each word group becomes a `drawtext` filter with `enable='between(t,start,end)'`
- Pros: Simple, already working
- Cons: No animation support. Cannot do word-level highlighting (only full text on/off). Font styling is limited.

**Recommendation: Use ASS for captions, keep `drawtext` for free-form text overlays.**

ASS subtitle generation:

```typescript
function generateASS(words: CaptionWord[], preset: CaptionPreset, resolution: [number, number]): string {
  const [w, h] = resolution;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${preset.fontFamily},${preset.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,${preset.fontWeight === 'bold' ? 1 : 0},0,0,0,100,100,0,0,1,${preset.outlineWidth ?? 2},0,2,10,10,${Math.round(h * (1 - preset.positionY / 100))},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = [];
  const groupSize = preset.groupSize;
  for (let i = 0; i < words.length; i += groupSize) {
    const group = words.slice(i, i + groupSize);
    const start = formatASSTime(group[0].startMs);
    const end = formatASSTime(group[group.length - 1].endMs);
    let text = group.map(w => w.word).join(" ");

    // For highlight preset, wrap active word in color override
    if (preset.animation === "highlight") {
      // Generate one event per word within the group with highlight overrides
      // This gets complex -- see ASS karaoke tags: {\k}
    }

    events.push(`Dialogue: 0,${start},${end},Caption,,0,0,0,,${text}`);
  }

  return header + events.join("\n");
}
```

### Step 7: Auto-Caption Flow (End to End)

**The user flow:**

1. User opens editor for a generated content project
2. The project has a voiceover audio asset (from TTS)
3. User clicks "Auto Captions" button in the toolbar or media panel
4. System calls `POST /api/captions/transcribe` with the voiceover asset ID
5. Backend transcribes via Whisper, returns word-level timestamps
6. Frontend creates a caption clip on the text track spanning the voiceover duration
7. Caption clip auto-applies the "clean-white" preset
8. User selects a different style preset if desired
9. User can edit individual words in the Inspector
10. On export, the caption data is converted to ASS and burned into the video

---

## Limitations and Honest Assessment

**Transcription accuracy:** Whisper is good but not perfect. Common issues:
- Filler words ("um", "uh") are transcribed and displayed. Users will want to delete these.
- Proper nouns and jargon may be misspelled. Users need word editing.
- Timing can be off by 50-100ms at word boundaries. This is usually not noticeable at 3-word group sizes but matters for 1-word-at-a-time styles.

**TTS voiceovers vs human speech:** ContentAI voiceovers are AI-generated (TTS), which is actually easier for Whisper to transcribe (clear pronunciation, no background noise, consistent pace). Accuracy will be higher than for real-world audio. This is an advantage.

**Animation complexity:** CapCut's pop-in and karaoke animations are rendered using a custom graphics engine. Replicating them exactly with ASS subtitles or canvas is hard. The MVP should stick to simpler styles (static text, word highlighting via color change) and add true motion animations post-MVP when the rendering pipeline is more mature.

**Font availability in ffmpeg:** The export server needs the same fonts used in the preview. Ship a small set of bundled fonts (Inter, Montserrat, Poppins) and reference them by absolute path in the ASS file. Do not allow arbitrary font selection in v1.

**Cost per caption generation:** Whisper costs $0.006/minute. For a 60-second reel, that is $0.006. Even at 100,000 caption generations per month, the cost is $600. This is negligible relative to the value. Include caption generation in the subscription with a generous daily limit (e.g., 50/day on Pro, 200/day on Business).

---

## Out of Scope (Defer)

- **Multi-language captions** (generating captions in a different language than the audio) -- requires translation, not just transcription. Defer.
- **Manual caption entry from scratch** (typing captions without a voiceover) -- low priority because ContentAI is built around generated voiceovers.
- **Caption templates per niche** (e.g., "finance niche uses bold outline, fitness uses pop-in") -- nice-to-have, can be a simple UI addition later.
- **SRT/VTT export** (exporting captions as a separate subtitle file) -- useful for YouTube, but reels do not use external subtitles. Defer.
- **Real-time caption editing during preview playback** -- complex UX. Users should pause, edit, then play. Defer interactive editing.

---

## Implementation Sequence

1. Backend: `captions` table + Whisper transcription endpoint -- 2 days
2. Frontend: Caption data model (CaptionWord, extend Clip type) -- 1 day
3. Frontend: Auto-caption button + API call + caption clip creation -- 1 day
4. Frontend: Caption style presets (data + preset picker in Inspector) -- 2 days
5. Frontend: Canvas caption preview rendering -- 3 days
6. Frontend: Word editing UI in Inspector -- 2 days
7. Backend: ASS subtitle generation + ffmpeg export integration -- 3 days
8. Testing (transcription accuracy, export quality, edge cases) -- 2 days

**Total estimated effort:** ~16 working days
