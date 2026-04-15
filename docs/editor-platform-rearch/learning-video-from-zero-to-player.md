# Learning Video (H.264/MP4/FFmpeg) Step-by-Step

This is a practical, incremental path to understanding how video files work and to writing a minimal video *player* in C (opening a file, demuxing, decoding, and displaying frames). If you can do that, you’re set up to understand how editors work.

**What you’ll build**

- A “first frame” tool: open a video file and decode the first frame to an image file.
- A minimal player: decode and display frames with proper timing.
- Optional: audio playback + A/V sync, seeking, and performance improvements.

**How to use this guide**

- Work through the phases in order.
- Don’t proceed until you can complete the “Done when” items.
- Keep a small repo or folder for experiments; name each milestone.

> Safety/legal note: work with your own test clips or clips you have rights to use. Avoid DRM-protected sources.

---

## Phase 0 — Setup (1–2 hours)

### Prerequisites

- Comfortable with the C toolchain (compile/link), pointers, structs, and manual memory management.
- Basic command line comfort.

### Install tools

- A C compiler (`clang` or `gcc`) and `make`/`cmake`.
- `ffmpeg` and `ffprobe` command-line tools.
- A hex viewer (`xxd`, `hexdump`, or a GUI tool).
- Optional but recommended: SDL2 (for frame display in your player milestone).

### Make a small test corpus

Create a folder with **4 short clips** (5–20 seconds each):

- H.264 in MP4 (baseline “common” case).
- H.264 in MKV (same codec, different container).
- H.265/HEVC in MP4 (to see “codec vs container” differences).
- A clip with audio (AAC) and video.

**Done when**

- You can run `ffmpeg -version` and `ffprobe -version`.
- You have a `samples/` folder with the 4 clips.

---

## Phase 1 — “Codec” vs “Container” (2–4 hours)

### Concepts

- **Codec**: how compressed audio/video is encoded/decoded (e.g., H.264, AAC).
- **Container**: file format that stores streams + metadata + timing (e.g., MP4, MKV).
- **Demuxing**: extracting streams from a container.
- **Decoding**: turning compressed packets into raw frames/samples.

### Exercises

1. For each sample clip:
   - Identify container, codecs, pixel format, resolution, frame rate, time base, and duration.
2. Extract the video stream without re-encoding.

Commands to learn (run, then read the output):

```bash
ffprobe -hide_banner -i samples/your.mp4
ffprobe -hide_banner -show_streams -show_format samples/your.mp4
ffmpeg -i samples/your.mp4 -c copy -map 0:v:0 out_video_only.mp4
```

**Done when**

- You can explain (in your own words) why “MP4” does not imply “H.264” and why “H.264” does not imply “MP4”.
- You can demux (stream copy) video-only and audio-only outputs from a file.

---

## Phase 2 — How H.264 compresses video (1–3 days)

You don’t need to be able to implement H.264, but you must understand *what the decoder is doing* conceptually.

### Core ideas

- Frames are predicted from other frames to save bits.
- **I-frames** (intra): self-contained keyframes.
- **P-frames** (predicted): predicted from past frames.
- **B-frames** (bi-predicted): predicted from past and future frames; improves compression; introduces reordering.
- **GOP** (Group of Pictures): pattern of I/P/B frames.
- **Motion compensation**: reuse blocks from reference frames with motion vectors.
- **Transform + quantization**: convert spatial detail to frequency-ish coefficients, then quantize (lossy).
- **Entropy coding**: compress the remaining symbols (CABAC/CAVLC).

### What to observe in real files

Use `ffprobe` to inspect frame types for a short segment:

```bash
ffprobe -hide_banner -select_streams v:0 -show_frames -show_entries frame=pict_type,key_frame,pkt_pts_time,best_effort_timestamp_time -of compact samples/your.mp4 | head
```

Try re-encoding with different GOP structures and compare file size and seek behavior:

```bash
ffmpeg -i samples/your.mp4 -c:v libx264 -g 240 -keyint_min 240 -sc_threshold 0 -an out_gop_long.mp4
ffmpeg -i samples/your.mp4 -c:v libx264 -g 60  -keyint_min 60  -sc_threshold 0 -an out_gop_short.mp4
```

**Done when**

- You can describe what I/P/B frames are *and* why B-frames mean decode order can differ from display order.
- You can explain why keyframe interval impacts seeking and file size.

---

## Phase 3 — MP4 container basics (1–2 days)

MP4 is built from **boxes/atoms** (e.g., `ftyp`, `moov`, `mdat`) arranged hierarchically.

### Key ideas to learn

- The difference between `moov` (metadata/index) and `mdat` (media data).
- Why “fast start” rearranges atoms (move `moov` before `mdat`).
- Tracks, sample tables, timescales, and edit lists (high-level).

### Exercises

1. Make an MP4 “fast start” and verify that `moov` moved.
2. Use a hex viewer to find `ftyp`, `moov`, `mdat` in the file.

Commands:

```bash
ffmpeg -i samples/your.mp4 -c copy -movflags +faststart out_faststart.mp4
xxd -g 1 -l 256 samples/your.mp4 | head
```

**Done when**

- You can point to where MP4 stores “index/timing” info vs the raw compressed payload.
- You can explain why some MP4s won’t start playing until the whole file downloads (hint: `moov` placement).

---

## Phase 4 — Timing: PTS/DTS, time bases, and frame display (1–3 days)

This is the part many people skip, then their “player” stutters or runs too fast.

### Concepts

- **PTS** (presentation timestamp): when a frame should be shown.
- **DTS** (decoding timestamp): when it must be decoded (can differ due to B-frames).
- **Time base**: the unit in which timestamps are measured (rational number).
- **VFR vs CFR**: variable vs constant frame rate.

### Exercises

1. Use `ffprobe` to print packet timestamps (PTS/DTS) for a few seconds and observe reordering.
2. Convert a VFR file to CFR and compare timestamps.

**Done when**

- You can explain PTS vs DTS.
- You can explain why a naïve “sleep 1/fps” loop is wrong for many files.

---

## Phase 5 — FFmpeg basics (CLI first) (1–2 days)

Even if you ultimately call libraries directly, the CLI teaches you the mental model: **demux → decode → filter → encode → mux**.

### Exercises

1. Decode a single frame to PNG/JPEG.
2. Dump raw video (YUV) and play it back with `ffplay`.

Commands:

```bash
ffmpeg -i samples/your.mp4 -frames:v 1 out.png
ffmpeg -i samples/your.mp4 -f rawvideo -pix_fmt yuv420p out.yuv
ffplay -f rawvideo -pixel_format yuv420p -video_size 1920x1080 out.yuv
```

**Done when**

- You can explain what a pixel format like `yuv420p` implies (at a high level).
- You can decode a frame and inspect it.

---

## Phase 6 — Your first decoder program (C) (2–7 days)

Goal: open a file, find the video stream, decode until you get the first `AVFrame`, then write it to disk.

### Recommended learning path

1. Read the classic tutorial (Karate Kid style):
   - `http://dranger.com/ffmpeg/ffmpeg.html`
2. Then *also* read a recent “modern FFmpeg API” example, because FFmpeg APIs evolve.

Important: Dranger’s tutorial teaches the *pipeline* and the “shape” of a player. Some function names and patterns may differ on current FFmpeg versions.

### What your program should do

- Accept an input filename.
- Initialize FFmpeg (`avformat_open_input`, `avformat_find_stream_info`).
- Locate the best video stream.
- Create and open a decoder (`avcodec_find_decoder`, `avcodec_alloc_context3`, `avcodec_open2`).
- Read packets (`av_read_frame`), send to decoder (`avcodec_send_packet`), receive frames (`avcodec_receive_frame`).
- Convert the first decoded frame into a writable pixel format (e.g., RGB) using `libswscale`.
- Write out an image (PPM is simplest) or raw RGB bytes.

### “Done when”

- Running `./firstframe samples/your.mp4 out.ppm` produces an image with the correct dimensions.
- The tool works for at least two different containers (MP4 and MKV) with H.264 video.

### Common pitfalls to debug

- Confusing packet time base with stream time base.
- Forgetting that decoders can buffer internally (you may need multiple packets before the first frame).
- Not handling `EAGAIN` / flushing at end of stream.

---

## Phase 7 — Minimal video player (C + SDL2) (1–2 weeks)

Goal: display decoded frames with correct timing (PTS-based).

### Features to implement (in order)

1. Open a window and display frames (no timing yet, just as fast as possible).
2. Implement frame timing using PTS (sleep/delay based on timestamps).
3. Handle resize / aspect ratio correctly.
4. Quit cleanly; free all resources.

**Done when**

- Playback speed matches `ffplay` for your test clips.
- CPU usage stays reasonable (it won’t be perfect, but it shouldn’t peg a core unnecessarily for small clips).

---

## Phase 8 — Audio + A/V sync (optional, 1–3 weeks)

If you want to understand editing and real players, you eventually need to handle audio and sync.

### Learn

- Audio sample formats, channel layouts, sample rates.
- Resampling (`libswresample`).
- Clocking: audio as the “master clock” vs video as master.

**Done when**

- Your player can play a clip with AAC audio and stay in sync for at least 60 seconds.

---

## Phase 9 — Seeking, indexing, and robustness (optional, ongoing)

### Topics

- Seek by timestamp; keyframe seeking; decode-to-target.
- Handling missing timestamps, VFR weirdness, and corrupted packets.
- Threaded decoding and frame queues.

**Done when**

- Your player can seek forward/backward reliably on a normal MP4 file.

---

## Phase 10 — From player to editor (what changes) (optional)

An editor is a player plus:

- Accurate timeline model (multiple tracks, cuts, transitions).
- Seeking and decoding arbitrary points quickly (cache + keyframe strategy).
- Re-encoding and muxing outputs.
- Effects/filters (often GPU-accelerated).

If you can build Phase 7–9, editor internals become a tractable engineering problem rather than “magic”.

---

## Suggested weekly cadence (example)

- **Week 1**: Phase 1–3 (codec/container), basic H.264 + MP4.
- **Week 2**: Phase 4–5 (timing + CLI pipeline).
- **Week 3**: Phase 6 (firstframe tool).
- **Week 4**: Phase 7 (SDL2 player).
- **Weeks 5+**: Phase 8–9 as needed.

---

## Troubleshooting checklist

When stuck, answer these in writing:

1. Am I demuxing the correct stream?
2. Am I passing packets through `send_packet`/`receive_frame` correctly (including `EAGAIN`)?
3. What are the stream `time_base`, frame `pts`, and computed display time?
4. Is the pixel format what I think it is? (Print it.)
5. If frames are green/purple: is my colorspace conversion correct?

---

## Minimal “glossary” you should be able to define

- codec, container, stream, track, demux/mux, packet, frame
- GOP, keyframe, I/P/B frame
- PTS, DTS, time base, CFR/VFR
- pixel format, colorspace, chroma subsampling (4:2:0)

---

## What I can do next (if you want)

- Generate a starter C project skeleton for Phase 6 (`firstframe`) using modern FFmpeg APIs.
- Add the Phase 7 SDL2 player skeleton (decode → queue → display with PTS timing).

