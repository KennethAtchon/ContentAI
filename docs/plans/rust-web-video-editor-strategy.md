# Rust Web Video Editor — Ship-It Strategy

**Goal**: Video editor running in the browser, fast. Keep your React UI. Use Rust/WASM for the heavy lifting.

**What to skip**: Deep codec knowledge, FFmpeg internals, C, SDL2. You don't need any of that.

---

## Architecture (one diagram)

```
React UI (existing)
    │
    │  JS calls
    ▼
Rust/WASM module  ←→  WebCodecs API (browser-native decode/encode)
    │
    ▼
Canvas / WebGL  (frame rendering)
    │
    ▼
Export: WebCodecs encode → MP4 (browser) or POST to server
```

- **React**: timeline UI, controls, state
- **Rust/WASM**: timeline model, frame scheduling, effects math, export logic
- **WebCodecs**: browser-native H.264 decode/encode — no FFmpeg, no codec knowledge needed
- **Canvas/WebGL**: draw frames; use `OffscreenCanvas` to keep the main thread unblocked

---

## What's actually causing your React limitations

Likely one of:
- Decoding frames on the main thread → janky UI
- Storing decoded frames in JS → memory blowups
- Canvas operations not fast enough → slow scrubbing

Rust/WASM fixes the compute bottleneck. WebCodecs fixes the decode bottleneck. WebWorkers fix the thread bottleneck.

---

## Tech stack (be opinionated, don't evaluate alternatives)

| Layer | Tool | Why |
|-------|------|-----|
| Rust → browser | `wasm-pack` + `wasm-bindgen` | Standard, works with any bundler |
| JS ↔ Rust types | `serde-wasm-bindgen` or `tsify` | Auto-generate TS types from Rust structs |
| Video decode | `VideoDecoder` (WebCodecs API) | Browser-native, no library needed |
| Video encode/export | `VideoEncoder` (WebCodecs API) | Same |
| Rendering | `OffscreenCanvas` + `WebGL2` or `wgpu` (WASM target) | GPU-accelerated frame display |
| Bundler | Vite + `vite-plugin-wasm` | Dead simple WASM integration |
| Fallback encode | `ffmpeg.wasm` | Drop-in for browsers missing WebCodecs or for MP4 muxing |

---

## WebCodecs — what you actually need to know

```
VideoFile → fetch() → ReadableStream
    → VideoDecoder.decode(chunk) → VideoFrame (raw pixels, GPU-backed)
    → drawImage(frame, canvas) → visible frame
    → frame.close()  ← CRITICAL, or you leak GPU memory
```

That's it. The browser handles H.264/H.265/VP9. You never touch codec internals.

For export:
```
VideoFrame → VideoEncoder.encode(frame) → EncodedVideoChunk → MP4 mux → download
```

MP4 muxing is the one annoying part — use `mp4-muxer` (npm) or `muxjs`. Don't write your own.

---

## Setup (do this first, ~2 hours)

```bash
# 1. Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# 2. Create the Rust crate inside your React project
mkdir editor-core && cd editor-core
cargo init --lib
# Cargo.toml: set crate-type = ["cdylib"]

# 3. Add deps to Cargo.toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }

# 4. Build
wasm-pack build --target web --out-dir ../src/wasm

# 5. In your React project
npm install vite-plugin-wasm vite-plugin-top-level-await
# add to vite.config.ts: plugins: [wasm(), topLevelAwait()]
```

Now you can call Rust functions from React:

```rust
// editor-core/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn timeline_frame_at(position_ms: f64, clips: JsValue) -> JsValue {
    // your timeline logic
}
```

```ts
// React component
import init, { timeline_frame_at } from './wasm/editor_core';
await init();
const frame = timeline_frame_at(1234.0, clips);
```

---

## Milestone 1 — First frame displayed (1–2 days)

Don't build the editor yet. Prove the pipeline works.

1. Fetch a video file in React
2. Pass chunks to `VideoDecoder` in a WebWorker
3. Get a `VideoFrame` back
4. Draw it on a `<canvas>`
5. `frame.close()`

No Rust yet. Validate WebCodecs works in your target browsers first.

**Done when**: You see a frame from a local video file on a canvas.

```ts
const decoder = new VideoDecoder({
  output: (frame) => {
    ctx.drawImage(frame, 0, 0);
    frame.close();
  },
  error: (e) => console.error(e),
});

decoder.configure({ codec: 'avc1.42001E' }); // H.264 baseline
// feed EncodedVideoChunks from your file...
```

---

## Milestone 2 — Timeline model in Rust (2–3 days)

Build the data model in Rust, expose it to React via wasm-bindgen.

```rust
#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
pub struct Clip {
    pub asset_id: String,
    pub in_point_ms: f64,   // where in the source file
    pub out_point_ms: f64,
    pub timeline_start_ms: f64,  // where on the timeline
}

#[wasm_bindgen]
pub struct Timeline {
    clips: Vec<Clip>,
}

#[wasm_bindgen]
impl Timeline {
    pub fn resolve_frame(&self, playhead_ms: f64) -> Option<FrameRequest> {
        // find which clip is active, return (asset_id, seek_time_ms)
    }
}
```

React owns the UI state. Rust owns the timeline logic. Pass data back and forth as JSON.

**Done when**: Given a playhead position, Rust returns "fetch frame X from asset Y".

---

## Milestone 3 — Scrubbing (3–5 days)

This is where editors win or die. Architecture:

```
MainThread: React UI → postMessage(playhead_ms) → Worker
Worker: VideoDecoder → draws to OffscreenCanvas → transfers to main thread
```

Key rules:
- **Never decode on the main thread**
- **Never store more than ~10 decoded frames at once** (GPU memory)
- On scrub: flush decoder, seek to nearest keyframe, decode forward to target frame

```ts
// Worker
const offscreen = canvas.transferControlToOffscreen();
const ctx = offscreen.getContext('2d');

self.onmessage = ({ data: { playhead_ms } }) => {
  const req = timeline.resolve_frame(playhead_ms); // Rust WASM call
  seekAndDecode(req.asset_id, req.seek_ms, ctx);
};
```

**Done when**: Dragging the playhead shows the right frame within ~200ms.

---

## Milestone 4 — Playback (2–3 days)

Add a `requestAnimationFrame` loop that advances the playhead and calls the worker.

Rust handles timing math:
```rust
#[wasm_bindgen]
pub fn next_frame_time_ms(current_ms: f64, speed: f64) -> f64 {
    current_ms + (1000.0 / 30.0) * speed
}
```

**Done when**: Play button plays at correct speed. Matches original file timing.

---

## Milestone 5 — Export (1–2 weeks)

Simplest path: re-encode everything.

```ts
const encoder = new VideoEncoder({
  output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
  error: console.error,
});
encoder.configure({ codec: 'avc1.42001E', width: 1920, height: 1080, bitrate: 5_000_000 });

// iterate timeline, decode each frame, pass to encoder
for (const frame of timelineFrames()) {
  encoder.encode(frame);
  frame.close();
}
await encoder.flush();
muxer.finalize();
// muxer = new Mp4Muxer (from 'mp4-muxer' npm package)
```

**Done when**: Exported MP4 plays correctly with right duration and cuts.

---

## What to do about ffmpeg.wasm

Use it **only** as a fallback or for edge cases (weird formats, audio-only export, etc). It's 25–35MB and slow to initialize. WebCodecs is faster and already in the browser.

```ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
const ffmpeg = new FFmpeg();
await ffmpeg.load(); // ~30MB download
// use only if VideoEncoder/VideoDecoder fail
```

---

## Browser support check

WebCodecs: Chrome 94+, Edge 94+, Firefox 130+, Safari 16.4+. Fine for 2026.

```ts
if (!('VideoDecoder' in window)) {
  // fallback to ffmpeg.wasm
}
```

---

## Rust libraries worth knowing

| Library | Use |
|---------|-----|
| `wasm-bindgen` | Rust ↔ JS bridge |
| `web-sys` | DOM/WebAPI bindings from Rust |
| `js-sys` | JS built-in types in Rust |
| `gloo` | Ergonomic web-sys wrappers |
| `wgpu` | GPU rendering from Rust/WASM (for effects) |

You don't need a Rust video codec library. WebCodecs handles that.

---

## What to ignore from the zero-to-player guide

Skip entirely:
- H.264 internals, GOP structure, entropy coding
- C/FFmpeg API, libavcodec, libswscale
- SDL2, PPM files
- MP4 box structure, `moov`/`mdat`

Skim only:
- PTS/DTS concept (you need to know frames have timestamps; that's enough)
- Pixel formats (know `yuv420p` → need color conversion; WebCodecs handles this for you)

---

## Order of operations

1. **Today**: Confirm WebCodecs works in your browser — run Milestone 1
2. **This week**: Rust/WASM setup + Timeline model (Milestones 2)
3. **Next week**: Scrubbing + Playback (Milestones 3–4)
4. **Week 3–4**: Export (Milestone 5)

If you hit a wall on WebCodecs (format not supported), drop in `ffmpeg.wasm` for that specific case only.
