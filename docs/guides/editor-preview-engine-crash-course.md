# Editor Preview Engine Rewrite Crash Course

> **Last updated:** 2026-04-09
> **Audience:** Someone starting from zero
> **Goal:** Help you understand what [`docs/plans/editor-preview-engine-rewrite.md`](../plans/editor-preview-engine-rewrite.md) is talking about, in plain English, from the ground up.

## 1. Why this guide exists

The rewrite plan is written for engineers who already know a lot of web, browser, video, and frontend terminology.

If you are new to this area, that document can feel like reading a repair manual for a machine you have never even seen before.

This guide starts earlier.

It explains:

- what the web browser is doing in general
- what a frontend app is
- what React is
- how video playback works in a browser
- why the current editor preview architecture is struggling
- what the rewrite is trying to build instead
- what the scary words in the plan actually mean

## 2. The big picture in one sentence

The plan is saying:

**"Our current browser video preview is built in a way that fights the browser, so we need to replace it with a system that treats audio timing as the source of truth and draws video frames onto a canvas instead of constantly bossing around `<video>` tags."**

If that sentence means nothing yet, that is okay. We will build up to it.

## 3. Start at the absolute beginning

### What is the web?

The web is a system where:

- a **server** stores data or files
- a **browser** asks for that data or those files
- the browser shows them to a human

When you open a website, your browser downloads instructions from a server.

Those instructions usually include:

- **HTML**: the structure of the page
- **CSS**: how the page looks
- **JavaScript**: how the page behaves

### What is a browser?

A browser is an app like Chrome, Safari, or Firefox.

Its job is to:

- download web files
- interpret HTML/CSS/JavaScript
- draw visuals on your screen
- play audio and video
- provide built-in features like timers, networking, and media playback

A useful mental model:

- the browser is like a small operating system for web apps
- JavaScript is the code we write to ask the browser to do things

### What is a web app frontend?

The **frontend** is the part the user directly interacts with.

In this project, the editor UI in the browser is frontend code.

That frontend:

- shows buttons, timelines, and previews
- reacts to clicks and key presses
- asks the backend for project data and media URLs
- tries to play back the edited timeline for the user

## 4. What this editor is trying to do

This editor is basically a mini video-editing app running inside a browser.

It has to:

- load a project
- understand the timeline
- know which clips should be visible at a given time
- know which audio should be heard at a given time
- show the result as a live preview while the user scrubs or presses play

That live preview is the heart of the plan.

## 5. A few core video-editing words

### Timeline

The **timeline** is the master schedule of the video.

It answers:

- at 0.0 seconds, what should be shown?
- at 3.2 seconds, which clip is active?
- at 7.5 seconds, what text should be on screen?

### Track

A **track** is one lane in the timeline.

Examples:

- video track
- audio track
- music track
- text track

### Clip

A **clip** is one item on a track.

Examples:

- a 4-second video shot
- a voiceover audio file
- a caption block
- some text on screen

### Playhead

The **playhead** is the current time position in the timeline.

If the playhead is at 5 seconds, the editor should show whatever belongs at 5 seconds.

### Scrubbing

**Scrubbing** means dragging the playhead around manually to inspect a specific moment.

### Playback

**Playback** means the playhead is moving forward automatically over time.

## 6. How browsers usually play video

The easiest way to play video in a web page is with an HTML element like this:

```html
<video src="movie.mp4" controls></video>
```

That gives the browser a lot of responsibility.

The browser will:

- load the file
- decode the compressed video
- decode the audio
- keep them in sync
- display frames on screen
- play sound through the speakers

This is great for normal websites.

It is not always great for building a professional editor.

## 7. What “decode” means

Video files are compressed.

A raw video is huge, so it gets packed into a smaller format like MP4.

To show it, the browser must **decode** it.

That means:

- read the compressed data
- turn it back into actual image frames
- turn compressed audio back into audio samples

You can think of decoding like unpacking a zipped file, except it has to happen fast enough for smooth playback.

## 8. Why video editing is harder than normal video playback

Normal playback is simple:

- one video file
- start at the beginning
- play forward steadily

An editor preview is harder because it may need to:

- jump to arbitrary times instantly
- combine multiple clips
- handle trims and speed changes
- show text and captions on top
- respond to user scrubbing
- stay smooth while the rest of the app UI is also running

A regular `<video>` element was mainly designed for "play this media file," not "act like the live engine of a nonlinear video editor."

## 9. What React is doing here

**React** is a frontend library for building user interfaces.

It helps developers describe UI as a function of state.

Very simplified:

- state changes
- React figures out what UI changed
- React updates the page

That is excellent for:

- forms
- buttons
- panels
- menus
- lists

It is much less ideal if you force it to help drive frame-by-frame video playback 60 times every second.

## 10. What `requestAnimationFrame` is

`requestAnimationFrame` is a browser API often shortened to **rAF**.

It lets JavaScript run code right before the browser draws the next screen update.

People often use it for:

- animations
- games
- visual updates

If the screen is updating around 60 times per second, then rAF may also run about 60 times per second.

## 11. What the current preview system is doing

The rewrite plan says the current system roughly does this:

1. run a JavaScript clock with `requestAnimationFrame`
2. update React state about 60 times per second
3. make React re-render the preview tree again and again
4. compare the JavaScript timeline time to the actual `<video>` element's current playback time
5. if they drift too far apart, force the video element to jump to the target time

That last part is the killer.

## 12. What `currentTime` means on a video element

A `<video>` element has a property called `currentTime`.

At first glance, it sounds like a harmless number you can set whenever you want.

Example:

```js
video.currentTime = 12.5;
```

But in practice, assigning to `currentTime` is not just "changing a number."

It is more like giving the browser a command:

**"Jump to 12.5 seconds in the media."**

That operation is called a **seek**.

## 13. What a seek is

A **seek** means jumping to a different point in audio or video.

Examples:

- dragging the scrubber to 1:23
- clicking ahead in a video
- code doing `video.currentTime = ...`

Seeks are relatively expensive because the browser may need to:

- stop its normal steady decode flow
- find the right place in the file
- decode from a nearby keyframe
- rebuild the right frame
- restart playback from there

Seeks are fine when the user intentionally scrubs.

Seeks are bad when they happen repeatedly during normal forward playback.

## 14. Why repeated seeks cause trouble

Imagine you are driving a car down a road.

A good playback engine is like smooth cruising.

The current system is more like:

- accelerate
- brake
- jerk the wheel a little
- accelerate again
- brake again

The plan says the app keeps "correcting" playback by seeking when the JavaScript clock and the media element drift apart.

That creates problems:

- video playback looks less smooth
- audio glitches because audio is tied to that same video element
- the browser's decode pipeline keeps getting interrupted
- React keeps doing unnecessary UI work on top of that

## 15. What “drift” means

**Drift** means two clocks that were supposed to match are no longer perfectly aligned.

Here, the two clocks are roughly:

- the app's JavaScript timeline clock
- the browser media element's own playback clock

If one says `10.00s` and the other says `10.12s`, they have drifted apart.

The current system tries to fix drift by forcing seeks.

The rewrite plan says that whole idea is wrong.

## 16. Why there are multiple clocks at all

This is one of the most important ideas in the whole document.

Different parts of the browser have different notions of time.

Examples:

- **JavaScript timers**: general-purpose timing, not perfectly stable
- **`requestAnimationFrame` time**: linked to screen painting
- **media playback clock**: the browser's own timing for `<video>` / `<audio>` playback
- **audio hardware clock**: the timing that drives sound output

The rewrite plan argues that for an editor preview, **audio timing is the most trustworthy master clock**.

## 17. Why audio is the best master clock

Humans notice audio glitches very easily.

If sound stutters, pops, or goes out of sync with lips, it feels broken immediately.

The Web Audio API provides an `AudioContext` with a clock called `currentTime`.

That clock is valuable because it is tied closely to the audio system.

The plan wants this model:

- audio clock is the source of truth
- video frames are shown to match the audio clock
- React is not in the middle of frame-by-frame timing

In short:

**Let the audio timeline lead. Make video follow it.**

## 18. What `AudioContext` is

`AudioContext` is a browser API for working with audio more directly and more precisely than a plain `<audio>` or `<video>` tag.

It lets developers:

- play and process sound
- connect audio nodes together
- control timing more precisely
- use the audio system's own clock

The plan treats `AudioContext.currentTime` as the master timeline.

## 19. What a canvas is

A **canvas** is a drawing surface in the browser.

Instead of telling the browser "please display this `<video>` tag here," you can say:

- give me a blank surface
- I will draw pixels onto it myself

That is useful for editors because it gives more control.

You can:

- draw video frame A
- then draw text on top
- then draw captions
- then draw overlays or effects

This process is called **compositing**.

## 20. What compositing means

**Compositing** means combining multiple visual layers into one final image.

In a video editor, that may mean combining:

- background video
- foreground video
- text
- captions
- effects
- masks

The rewrite plan wants the preview to use a canvas-based compositor instead of relying on a bunch of mounted HTML media elements.

## 21. What `OffscreenCanvas` is

`OffscreenCanvas` is a browser feature that lets canvas-related work happen away from the main page UI thread.

That matters because the browser only has so much attention to give.

If one thread is busy doing:

- React updates
- layout
- button handling
- panel rendering

then video work can suffer.

Moving work off the main thread helps keep the UI and playback smoother.

## 22. What a thread is

A **thread** is a place where code runs.

You do not need the low-level computer science version yet.

For this topic, the important idea is:

- the **main thread** runs a lot of normal page logic and UI work
- extra work can sometimes be moved elsewhere so the main thread does not get overloaded

## 23. What a Worker is

A **Worker** is a browser feature that lets JavaScript run in a separate thread.

Why use one?

Because decoding media and managing frame pipelines can be expensive.

The rewrite plan wants a Worker to handle decode work so the main thread can mostly focus on:

- receiving decoded frames
- drawing them to canvas
- staying responsive

## 24. What WebCodecs is

**WebCodecs** is a browser API that gives lower-level access to media decoding and encoding.

Instead of saying:

- "browser, please play this whole video element for me"

it lets you do something more like:

- "browser, decode these video chunks into frames"
- "browser, decode these audio chunks into audio data"

This is a much better fit for building a custom editor engine.

The key classes mentioned in the plan are:

- `VideoDecoder`
- `AudioDecoder`
- `VideoFrame`

## 25. What a `VideoFrame` is

A `VideoFrame` is basically one decoded image from the video.

If a video is 30 frames per second, then 1 second of video contains about 30 frames.

A custom preview engine can:

- decode frames
- choose the right frame for the current timeline moment
- draw that frame onto canvas

That is more direct and more controllable than repeatedly commanding a `<video>` element.

## 26. What a demuxer is

A media file like MP4 contains multiple streams mixed together inside one container.

Usually that includes:

- video data
- audio data
- timing metadata

A **demuxer** separates that container into the individual streams.

Very loosely:

- MP4 file comes in
- demuxer splits it into video chunks and audio chunks
- decoders decode those chunks

The rewrite plan mentions tools like `mp4box.js` and `web-demuxer` for this job.

## 27. What a keyframe is

A **keyframe** is a self-contained video frame.

Many other frames are not fully independent. They store only changes from nearby frames.

That means when you want frame 157, the decoder may need to start from an earlier keyframe and work forward.

This is why random seeking in compressed video is trickier than it sounds.

## 28. What GOP means

**GOP** means **Group of Pictures**.

It is basically a run of frames that starts with a keyframe and then includes dependent frames after it.

Why it matters:

- if you seek to a frame in the middle of a GOP
- the decoder usually needs the earlier keyframe first
- then it must decode forward until it reaches the target frame

That is why the plan talks about **GOP-aware seeking**.

It means:

- understand keyframes
- seek correctly
- do not ask the decoder for impossible shortcuts

## 29. What the rewrite wants to replace

The plan is not trying to replace the whole editor.

It is mostly replacing the **preview runtime**.

That means the part that turns timeline data into live audio/video preview.

The plan explicitly says some parts are staying:

- the timeline data model
- the reducer/state model
- autosave
- undo/redo
- export pipeline

So the goal is not "rewrite the editor from scratch."

The goal is:

**"keep the editor data model, replace the playback engine."**

## 30. The old mental model vs the new one

### Old mental model

- React state is updated constantly
- React re-renders the preview tree constantly
- HTML video elements are mounted as the visual playback surface
- JavaScript keeps checking whether the video elements are on the right time
- if not, JavaScript seeks them into place

This is like trying to conduct an orchestra by yanking instruments into place every second.

### New mental model

- timeline data tells the engine what should happen
- audio clock is the master clock
- Worker decodes media
- decoded video frames are sent to the compositor
- canvas displays the final image
- React mostly stays out of the real-time playback loop

This is much closer to how a real media engine behaves.

## 31. Why React re-rendering 60 times per second is a problem

React is not evil here. It is just being used for the wrong job.

Re-rendering at frame rate means:

- React has to compare trees constantly
- components re-run constantly
- more preview features means more work every frame
- the main thread gets busier and busier

That creates competition for time:

- should the browser spend effort updating side panels and component trees?
- or decoding and presenting media smoothly?

The rewrite chooses a clearer boundary:

- React manages UI and controls
- the preview engine manages playback and drawing

## 32. What “imperative” means in this context

The plan says the new engine will work more **imperatively**.

That just means:

- instead of React declaratively re-rendering everything from state every frame
- there will be an engine object with commands like `play()`, `pause()`, `seek(ms)`, `updateTimeline(...)`

This is often the right shape for a media engine.

## 33. Why audio glitches happen today

The plan says the current preview takes audio from the same `<video>` elements that are being seek-corrected.

So when code keeps doing time corrections, it is not only moving the picture.

It is also disturbing the audio playback pipeline.

That can cause:

- pops
- dropouts
- audible jumps
- unstable sync

The rewrite separates concerns more cleanly and makes audio timing central instead of incidental.

## 34. Why the plan says this cannot be fixed with “small tweaks”

This is the main opinionated claim in the rewrite plan.

It says the issue is not:

- a bad threshold
- a missing `useMemo`
- a tiny sync bug

It says the issue is architectural.

Meaning:

- the pieces are connected in the wrong way
- the system is fighting itself
- local fixes will not solve the core mismatch

That is why the plan calls for deleting the old preview runtime instead of carefully patching it forever.

## 35. What “frame-accurate” means

**Frame-accurate** means the preview shows the exact frame that should correspond to the current timeline time.

If the playhead says a certain frame should be visible, the engine should show that frame, not one slightly before or after.

This matters for:

- precise cuts
- caption timing
- effects timing
- transitions
- export trust

## 36. What “glitch-free 1x playback” means

**1x playback** means normal speed.

**Glitch-free** means:

- no visible stutter from avoidable seeks
- no audio pops from constant correction
- no obvious audio/video drift

It does not mean perfection under every exotic condition.

The plan explicitly says extreme reverse playback and very high playback rates are not the main target.

## 37. Why Safari is mentioned

Not every browser supports every media API equally well.

The plan notes that Safari does not fully match the others for `AudioDecoder`.

That matters because a rewrite like this is not just about the ideal architecture.

It also needs fallback behavior for real browsers in the wild.

So one part of the engineering work is:

- build the preferred modern path
- handle browser gaps without collapsing the whole design

## 38. Why the plan mentions CapCut, Diffusion Studio, and Replit

These are examples and inspiration.

They help answer:

- is this architecture weird or proven?
- do serious browser-based video tools use similar ideas?

The plan is basically saying:

- serious editors do not rely on seek-corrected HTML video tags as their core preview engine
- they use lower-level media pipelines, custom compositing, and more careful timing models

## 39. What the phases of the rewrite mean in plain English

### Phase 0: Remove the old playback machinery

Plain English:

- delete the old preview runtime pieces
- leave a simple placeholder canvas so the app still compiles
- stop pretending the old engine is salvageable

### Phase 1: Teach a Worker to decode clips correctly

Plain English:

- load media files
- split them into audio/video streams
- decode frames in a Worker
- make seeking work properly using keyframes

### Later phases

Though the snippet you gave starts with the early phases, the overall shape is:

- build decode pipeline
- build audio-clock-based playback
- build canvas compositor
- hook it into the existing editor timeline model
- make scrubbing and playback feel correct

## 40. The shortest honest summary of the technical argument

Here is the whole thing stripped down:

- browsers are good at normal media playback
- browsers are less good when you try to use normal media tags as the engine for a real editor
- our current preview system uses React and HTML video elements in a way that creates too much timing conflict and too much main-thread work
- repeated seek corrections are especially harmful
- a better architecture is to decode media more directly, use audio as the master clock, and draw frames onto canvas

## 41. Glossary of scary words from the plan

| Word | Plain-English meaning |
|------|------------------------|
| architecture | The high-level way a system is designed and how its parts fit together |
| runtime | The part that actually runs while the app is being used |
| render | To draw or display something |
| re-render | To draw/update the UI again because state changed |
| main thread | The browser's primary lane for page/UI work |
| Worker | A separate thread for background work |
| decode | Turn compressed media into usable frames or audio samples |
| demux | Split a media container into separate streams |
| compositor | The part that combines visual layers into one final image |
| canvas | A drawable surface in the browser |
| OffscreenCanvas | A canvas feature designed to support off-main-thread work |
| WebCodecs | Browser APIs for lower-level audio/video decoding and encoding |
| `VideoDecoder` | A WebCodecs object that decodes compressed video into frames |
| `AudioDecoder` | A WebCodecs object that decodes compressed audio into audio data |
| `VideoFrame` | One decoded frame/image from video |
| seek | Jump to a different media time |
| scrub | Manually drag through time |
| drift | Two clocks/timelines slowly stop matching |
| clock | The timing source used to decide "what time is it right now?" |
| `requestAnimationFrame` | Browser callback for running code near the next visual paint |
| `AudioContext` | Web Audio API object with a strong timing clock |
| keyframe | A self-contained frame you can start decoding from |
| GOP | A keyframe plus the dependent frames after it |
| frame-accurate | Showing the exact intended frame for a given timeline moment |
| imperative | Controlling something with direct commands like `play()` and `seek()` |

## 42. If you only remember five things, remember these

1. The editor preview is a tiny video player/editor engine inside the browser.
2. The current system uses React updates and HTML video seeks too heavily.
3. Setting `video.currentTime` is a seek command, not a harmless number update.
4. For serious preview sync, audio timing is usually the most trustworthy master clock.
5. The rewrite is about replacing the preview engine, not rewriting the whole editor product.

## 43. A beginner-friendly analogy

Imagine a stage play.

### Current system

- one person watches a wristwatch and shouts time updates 60 times per second
- another person keeps repositioning the actors when they seem slightly off
- the musicians are attached to those same actors and get interrupted whenever actors are moved
- meanwhile the whole theater crew rechecks the set every time the wristwatch updates

That is messy and jittery.

### Proposed system

- the orchestra conductor's beat is the source of truth
- musicians follow that beat
- actors move according to that same beat
- stage crew prepares the right scene in advance
- the audience sees one composed final stage picture

That is much closer to the rewrite's idea.

## 44. How to read the original rewrite doc now

When you go back to the original plan, read it in this order:

1. **Problem Statement**
Meaning: why the current setup is fundamentally struggling.
2. **Goals**
Meaning: what success looks like in concrete terms.
3. **Background / files to delete**
Meaning: which existing pieces are considered the old engine.
4. **Research Summary**
Meaning: evidence that the new architecture is technically sound.
5. **Options Considered**
Meaning: why the plan rejects small patches and prefers a real rewrite.
6. **Implementation Plan**
Meaning: how the team wants to replace the old system step by step.

## 45. Final takeaway

The plan is not just saying "our video preview is buggy."

It is saying something stronger:

**"Our preview engine is built on the wrong control model. Instead of constantly correcting HTML media elements from React and JavaScript clocks, we should build a proper media engine: decode in a Worker, drive sync from audio time, and draw frames through a canvas compositor."**

Once that clicks, the whole document becomes much easier to follow.
