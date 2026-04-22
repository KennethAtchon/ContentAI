I just developed the preview system and I'm getting these errors:

```
An AudioContext was prevented from starting automatically. It must be created or resumed after a user gesture on the page. index.mjs:12512:27
An AudioContext was prevented from starting automatically. It must be created or resumed after a user gesture on the page. 2 AudioMixer.ts:53:44
WebGL warning: linkProgram: Uniform `u_resolution` is not linkable between attached shaders.
An AudioContext was prevented from starting automatically. It must be created or resumed after a user gesture on the page. useWaveformData.ts:12:26
[2026-04-22T06:28:20.654Z] [ERROR] External API request failed after all retries | service=safe-fetch operation=request-failed 
Object { requestId: "fetch_15bfbe20-0b5a-4edf-8432-9b1c776f89df", url: "http://localhost:3000/api/editor/6d262766-d7b0-4ceb-8464-8eb0caaaa468", method: "GET", attempts: 3, duration: 3002, errorId: "err_5dd208b2-c924-4c0f-9899-8e17762db09b", error: "The operation was aborted. " }
debug.ts:119:7
[DecoderPool] Worker uncaught error for clip 750282ce-d837-4b30-8e8c-09052784281e: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
console.table() PreviewEngine.ts:807:13
(index)	level	scale	disableEffects	reason	activeDecoderCount	maxActiveDecoderCount	decodeWindowMs	readyDecoderCount	seekingDecoderCount	pendingSeekCount	assetWorkerCounts	maxWorkersPerAssetUrl	metadataCache	clipSeekMetrics	clipIds	Values
seekCount																0
decodedFrameCount																1
droppedFrameCount																0
compositorFrameMs																0
reactPublishMs																0
audioClockDriftMs																501
decoderBudgetReason																steady
previewQuality	full	1	false	steady												
lastSeekLatency																null
decoderPool					0	4	5000	0	0	0	
Object {  }
	1	
Object { entryCount: 1, assetUrls: (1) […] }
	
Object {  }
	
Array []

DecoderPool] Worker uncaught error for clip 750282ce-d837-4b30-8e8c-09052784281e: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
[DecoderPool] Worker uncaught error for clip 3b147d23-276e-4eea-bcbb-90f8e3cb35fd: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
[DecoderPool] Worker uncaught error for clip 750282ce-d837-4b30-8e8c-09052784281e: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
[DecoderPool] Worker uncaught error for clip 3b147d23-276e-4eea-bcbb-90f8e3cb35fd: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
[DecoderPool] Worker uncaught error for clip df796e33-25a3-40bb-af42-36c4075ed90c: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk ClipDecodeWorker.ts:536:23
[DecoderPool] Worker uncaught error for clip c7436da6-132d-4003-8b80-1c3b233f4ec2: 
error { target: Worker, isTrusted: true, message: "DataError: VideoDecoder.decode: VideoDecoder needs a key chunk", filename: "http://localhost:3000/src/features/editor/engine/ClipDecodeWorker.ts?worker_file&type=module", lineno: 536, colno: 23, srcElement: Worker, currentTarget: Worker, eventPhase: 2, bubbles: false, … }
DecoderPool.ts:799:13
DataError: VideoDecoder.decode: VideoDecoder needs a key chunk
```

Furthermore, react is renderering for every single ticket when I'm running the playback. This should not be happening, react shouldnt be involved in the playback loop or anything thats high FPS, this is a major bug.

Can you investigate these bugs and come up with a markdown explaining whats going on and how to go about fixing them?

I dont want incremental improvements, if theres something drastically wrong (like react renderering multiple times) that requires a very big change, then tell me about the change so I can decide.

Example: EditorWorkspace renders 900 times in 9 seconds...the way im calculating the renderering is by using million debug tool.

Also for the performance tracking, where exactly does the performance gets logged to because I dont see it at all. 