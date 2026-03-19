# variant-4-paper.html — UI Structure

## Top-Level Layout

The page is a full-viewport (`100vh`) vertical flex column with `overflow: hidden` and a `min-width: 1280px`. It is divided into three horizontal bands stacked top-to-bottom:

1. **Toolbar** (fixed height: 54px)
2. **Workspace** (flex: 1, fills remaining height)
3. **Timeline Section** (fixed height: 296px)

---

## 1. Toolbar (54px)

A single horizontal row with `align-items: center` and 16px horizontal padding.

**Left group (left to right):**
- Editable project title — an `<input type="text">` with an underline-only border (no box). Min-width 200px.
- Vertical separator (1px × 22px)
- Undo button (text + icon)
- Redo button (text + icon)
- Vertical separator
- Transport controls — 5 icon-only circular buttons: Jump-to-start, Rewind, Play/Pause, Fast-forward, Jump-to-end
- Timecode display — read-only text in a serif italic font, 18px, monospace-spaced. Format: `HH:MM:SS:FF`. Min-width 150px, center-aligned.
- Vertical separator
- Zoom-out icon button (`−`)
- Zoom percentage label (e.g. `100%`, 36px min-width, center-aligned)
- Zoom-in icon button (`+`)
- Fit button (text label)

**Right group (pushed to far right via `margin-left: auto`):**
- Export button — primary-styled pill button with an upload arrow icon

---

## 2. Workspace

A horizontal flex row that fills all space between the toolbar and timeline. Three columns:

### 2a. Media Panel (220px wide, left side)

Fixed-width column with a right border. Flex column layout:

- **Tab bar** — horizontal row of 4 tabs: Media, Effects, Audio, Text. Active tab has an underline indicator. Tabs are at the top of the panel with a bottom border.
- **Search bar** — full-width pill-shaped `<input type="search">` with a placeholder, padded 8px, bottom border.
- **Media grid** — 2-column CSS grid of thumbnail cards. Each thumbnail:
  - 16:9 aspect ratio
  - Has decorative film-sprocket-hole strips on left and right edges via `::before` / `::after` pseudo-elements (vertical repeating pattern)
  - Label bar at the bottom of the thumbnail (clipped with `text-overflow: ellipsis`)

### 2b. Preview Area (flex: 1, center)

Center column, fills all remaining width. Content is centered both axes. Max-width wrapper of 620px:

- **Label** — small italic caption above the screen, center-aligned: `— preview monitor —`
- **Preview screen** — 16:9 aspect-ratio dark rectangle with:
  - Film-strip decorative edges on left and right sides (12px wide, vertical repeating stripes) via pseudo-elements
  - Centered play icon (large, semi-transparent)
  - **Timecode overlay** — absolute-positioned, bottom-left corner, italic serif font
  - **Resolution badge** — absolute-positioned, top-right corner, small pill (e.g. `1080p`)
- **Meta row** — two-column flex row below the screen:
  - Left: current position / total duration (e.g. `00:00 / 02:00`)
  - Right: resolution and framerate (e.g. `1920 × 1080 · 24 fps`)

### 2c. Inspector (244px wide, right side)

Fixed-width column with a left border. Flex column, vertically scrollable.

- **Header** — italic serif label: `Inspector`, with a bottom border.

**Empty state (shown when no clip selected):**
- Centered vertically and horizontally
- Large decorative glyph (`✦`) at 36px, low opacity
- Two-line italic serif instruction text below it

**Populated state (shown when a clip is selected):**
Four collapsible-style sections, each with a dashed bottom border and a section title in small-caps uppercase:

1. **Clip** — 4 prop rows: Name, Start, Duration, Speed. Each row is label + value pill (right-aligned number).
2. **Look** — 3 slider rows: Opacity, Warmth, Contrast. Each row: label + range slider + numeric readout.
3. **Transform** — 4 prop rows: Position X, Position Y, Scale, Rotation.
4. **Sound** — 1 slider row (Volume) + 1 toggle row (Mute). Toggle is a pill-shaped on/off switch.

---

## 3. Timeline Section (296px tall)

A horizontal strip anchored to the bottom of the viewport. Internal flex column:

### Timeline Toolbar (32px)
Single row with left border styling:
- Left: bold label `Timeline`
- Right: italic info text showing current zoom and duration (e.g. `40 px/s · 2 min`)

### Timeline Main Area (flex: 1)

A horizontal flex row:

#### Track Headers Column (186px wide, fixed)
Vertical stack of fixed-height rows (56px each):
- **Spacer row** (32px tall) — aligns with the ruler. Contains small uppercase label `Tracks`.
- **Track header row** × 4 (one per track):
  - Colored swatch bar (8px × 28px, pill-shaped)
  - Track name (truncated with ellipsis if needed)
  - `M` button (Mute) — small circular icon button, turns accented color when muted
  - `L` button (Lock) — small circular icon button

#### Scrollable Track Area (flex: 1)
Horizontally scrollable container. Contains a single `tl-content` div sized to `total_duration × pixels_per_second`:

- **Ruler** (32px tall) — time ruler spanning the full content width. Contains tick marks:
  - Major ticks: taller line + timecode label above (italic serif)
  - Minor ticks: shorter line, no label
  - Clicking/dragging the ruler seeks the playhead

- **Tracks area** — vertical stack of 4 track lanes (56px each), each full content-width:
  - Dashed bottom borders between lanes
  - Each lane contains positioned clip elements

- **Clips** — absolutely positioned rectangles within their lane:
  - `top: 7px`, `height: track-height - 14px` (inset from lane edges)
  - Film-sprocket-hole decorations on left and right edges via pseudo-elements (vertical repeating pattern, 4px wide)
  - Hover-reveal trim handles on left and right edges (8px wide, `cursor: ew-resize`), each with a small centered vertical bar indicator
  - SVG waveform overlay inside clip (full coverage, low opacity):
    - Audio tracks: vertical bar waveform pattern
    - Video/effects tracks: horizontal dashed lines
  - Clip name label (top, truncated)
  - Duration label (bottom, small, low opacity)
  - Selected state: 2px outline ring

- **Playhead** — absolutely positioned vertical line spanning full height of content:
  - 2px wide line
  - Circular drag handle at the top (12px diameter, centered on line, with a drop shadow)
  - `z-index: 20` (renders above all clips)
