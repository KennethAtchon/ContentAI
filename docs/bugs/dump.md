[2026-04-24T02:51:24.696Z] [DEBUG] Priming audio context | component=PreviewEngine
[2026-04-24T02:51:24.857Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=2 isPlaying=true
[2026-04-24T02:51:24.857Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.857Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.857Z] [DEBUG] Starting playback | component=PreviewEngine currentTimeMs=0 durationMs=15022
[2026-04-24T02:51:24.911Z] [DEBUG] Reconciling decoder workers | component=DecoderPool playheadMs=0 trackCount=4 assetUrlCount=5 activeWorkersBefore=1
[2026-04-24T02:51:24.912Z] [DEBUG] Collected decode candidates | component=DecoderPool playheadMs=0 activeClipCount=1 candidateCount=1
[2026-04-24T02:51:24.912Z] [DEBUG] Selected permitted clip IDs | component=DecoderPool candidateCount=1 permittedCount=1
[2026-04-24T02:51:24.912Z] [DEBUG] Reused existing worker | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 assetUrl=https://contentai.6fd750f4a4da03765c02f275b4bd2dd0.r2.cloudflarestorage.com/testing/video-clips/feab3bd5-83b8-4973-b2e4-bfeda310a251/dev-mock-slot1-1776839074887.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=48f5c50dfaa963b2bd7548ec627b5ca3%2F20260424%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260424T025118Z&X-Amz-Expires=3600&X-Amz-Signature=24a5e476ca4137e32ff06c9217fd06a94984e865d9bd84c27e2a99e38af34939&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject
[2026-04-24T02:51:24.912Z] [DEBUG] Finished worker reconciliation | component=DecoderPool playheadMs=0 activeClipCount=1 candidateCount=1 permittedCount=1 activeWorkersAfter=1
[2026-04-24T02:51:24.912Z] [DEBUG] Seeking all active decoders | component=DecoderPool playheadMs=0 workerCount=1
[2026-04-24T02:51:24.912Z] [DEBUG] Allocated next seek token | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 seekToken=2
[2026-04-24T02:51:24.912Z] [DEBUG] Received seek request | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 sourceTimeMs=0 seekToken=2 ready=true seeking=false playAfterSeek=false
[2026-04-24T02:51:24.912Z] [DEBUG] Posting SEEK to worker | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 sourceTimeMs=0 seekToken=2 playAfterSeek=false
[2026-04-24T02:51:24.912Z] [DEBUG] Completed seekAll dispatch | component=DecoderPool playheadMs=0 seekCount=1
[2026-04-24T02:51:24.912Z] [DEBUG] Entering play mode | component=DecoderPool workerCount=1
[2026-04-24T02:51:24.912Z] [DEBUG] Deferred PLAY until seek/ready | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 ready=true seeking=true
[2026-04-24T02:51:24.912Z] [DEBUG] Starting RAF loop | component=PreviewEngine currentTimeMs=0 fps=30
[2026-04-24T02:51:24.912Z] [DEBUG] Playback started | component=PreviewEngine requestToken=1 currentTimeMs=0
[2026-04-24T02:51:24.914Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=85.33333333333371
[2026-04-24T02:51:24.914Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=85.33333333333371 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.914Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=85.33333333333371 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.919Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=2 captionBitmapVersion=4 isPlaying=true
[2026-04-24T02:51:24.919Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.919Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.919Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.919Z] [DEBUG] Recorded first accepted frame latency | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 latencyMs=8 targetMs=0
[2026-04-24T02:51:24.919Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 seekToken=2 acceptedFrameCount=2
[2026-04-24T02:51:24.919Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 decodedFrameCount=1 isPlaying=true
[2026-04-24T02:51:24.919Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 frameTimestampUs=0 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.919Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 frameTimestampUs=0 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.919Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=SEEK_DONE destroyed=false
[2026-04-24T02:51:24.919Z] [DEBUG] Processed SEEK_DONE | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 seekToken=2 hasPendingSeek=false playAfterSeek=true isPlaying=true
[2026-04-24T02:51:24.919Z] [DEBUG] Posted PLAY after seek completion | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37
[2026-04-24T02:51:24.922Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=96.00000000000009
[2026-04-24T02:51:24.923Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=96.00000000000009 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.923Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=96.00000000000009 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.926Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=5 isPlaying=true
[2026-04-24T02:51:24.927Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.927Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.928Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.929Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 seekToken=null acceptedFrameCount=3
[2026-04-24T02:51:24.929Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 decodedFrameCount=2 isPlaying=true
[2026-04-24T02:51:24.929Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 frameTimestampUs=0 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.929Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=0 frameTimestampUs=0 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.931Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.931Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=41708 seekToken=null acceptedFrameCount=4
[2026-04-24T02:51:24.931Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=41708 decodedFrameCount=3 isPlaying=true
[2026-04-24T02:51:24.931Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=41708 frameTimestampUs=41708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.931Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=41708 frameTimestampUs=41708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.931Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=96.00000000000009
[2026-04-24T02:51:24.931Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=96.00000000000009 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.931Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=96.00000000000009 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.935Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=6 isPlaying=true
[2026-04-24T02:51:24.935Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.935Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.936Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.936Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=83417 seekToken=null acceptedFrameCount=5
[2026-04-24T02:51:24.936Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=83417 decodedFrameCount=4 isPlaying=true
[2026-04-24T02:51:24.936Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=83417 frameTimestampUs=83417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.936Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=83417 frameTimestampUs=83417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.938Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=106.66666666666646
[2026-04-24T02:51:24.939Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=106.66666666666646 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.939Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=106.66666666666646 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.944Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=7 isPlaying=true
[2026-04-24T02:51:24.944Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.944Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.944Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.944Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=125125 seekToken=null acceptedFrameCount=6
[2026-04-24T02:51:24.944Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=125125 decodedFrameCount=5 isPlaying=true
[2026-04-24T02:51:24.944Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=125125 frameTimestampUs=125125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.944Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=125125 frameTimestampUs=125125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.945Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.945Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=166833 seekToken=null acceptedFrameCount=7
[2026-04-24T02:51:24.945Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=166833 decodedFrameCount=6 isPlaying=true
[2026-04-24T02:51:24.945Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=166833 frameTimestampUs=166833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.945Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=166833 frameTimestampUs=166833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.947Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=117.33333333333374
[2026-04-24T02:51:24.947Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=117.33333333333374 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.947Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=117.33333333333374 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.951Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=8 isPlaying=true
[2026-04-24T02:51:24.951Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.951Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.951Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.951Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=208542 seekToken=null acceptedFrameCount=8
[2026-04-24T02:51:24.951Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=208542 decodedFrameCount=7 isPlaying=true
[2026-04-24T02:51:24.951Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=208542 frameTimestampUs=208542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.951Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=208542 frameTimestampUs=208542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.955Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.955Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=250250 seekToken=null acceptedFrameCount=9
[2026-04-24T02:51:24.955Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=250250 decodedFrameCount=8 isPlaying=true
[2026-04-24T02:51:24.955Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=250250 frameTimestampUs=250250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.955Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=250250 frameTimestampUs=250250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.956Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=128.0000000000001
[2026-04-24T02:51:24.956Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=128.0000000000001 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.956Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=128.0000000000001 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.959Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=9 isPlaying=true
[2026-04-24T02:51:24.959Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.959Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.960Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=291958 seekToken=null acceptedFrameCount=10
[2026-04-24T02:51:24.960Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=291958 decodedFrameCount=9 isPlaying=true
[2026-04-24T02:51:24.960Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=291958 frameTimestampUs=291958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.960Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=291958 frameTimestampUs=291958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.964Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=128.0000000000001
[2026-04-24T02:51:24.964Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=128.0000000000001 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.964Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=128.0000000000001 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.967Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.967Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=333667 seekToken=null acceptedFrameCount=11
[2026-04-24T02:51:24.967Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=333667 decodedFrameCount=10 isPlaying=true
[2026-04-24T02:51:24.967Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=333667 frameTimestampUs=333667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.967Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=333667 frameTimestampUs=333667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.969Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=10 isPlaying=true
[2026-04-24T02:51:24.969Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.969Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.969Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.969Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=375375 seekToken=null acceptedFrameCount=12
[2026-04-24T02:51:24.969Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=375375 decodedFrameCount=11 isPlaying=true
[2026-04-24T02:51:24.969Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=375375 frameTimestampUs=375375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.969Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=375375 frameTimestampUs=375375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.972Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=138.6666666666665
[2026-04-24T02:51:24.973Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=138.6666666666665 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.973Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=138.6666666666665 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.977Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=11 isPlaying=true
[2026-04-24T02:51:24.977Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.977Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.977Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.977Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=417083 seekToken=null acceptedFrameCount=13
[2026-04-24T02:51:24.977Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=417083 decodedFrameCount=12 isPlaying=true
[2026-04-24T02:51:24.977Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=417083 frameTimestampUs=417083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.977Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=417083 frameTimestampUs=417083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.977Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.977Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=458792 seekToken=null acceptedFrameCount=14
[2026-04-24T02:51:24.977Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=458792 decodedFrameCount=13 isPlaying=true
[2026-04-24T02:51:24.977Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=458792 frameTimestampUs=458792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.977Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=458792 frameTimestampUs=458792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.980Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=149.33333333333377
[2026-04-24T02:51:24.981Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=149.33333333333377 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.981Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=149.33333333333377 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.985Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=12 isPlaying=true
[2026-04-24T02:51:24.985Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.985Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.985Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.985Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=500500 seekToken=null acceptedFrameCount=15
[2026-04-24T02:51:24.985Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=500500 decodedFrameCount=14 isPlaying=true
[2026-04-24T02:51:24.985Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=500500 frameTimestampUs=500500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.985Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=500500 frameTimestampUs=500500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.987Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.987Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=542208 seekToken=null acceptedFrameCount=16
[2026-04-24T02:51:24.987Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=542208 decodedFrameCount=15 isPlaying=true
[2026-04-24T02:51:24.987Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=542208 frameTimestampUs=542208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.987Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=542208 frameTimestampUs=542208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.989Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=160.00000000000014
[2026-04-24T02:51:24.989Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=160.00000000000014 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.989Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=160.00000000000014 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:24.994Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=13 isPlaying=true
[2026-04-24T02:51:24.994Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:24.994Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:24.994Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.994Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=583917 seekToken=null acceptedFrameCount=17
[2026-04-24T02:51:24.994Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=583917 decodedFrameCount=16 isPlaying=true
[2026-04-24T02:51:24.994Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=583917 frameTimestampUs=583917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.994Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=583917 frameTimestampUs=583917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.997Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:24.997Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=625625 seekToken=null acceptedFrameCount=18
[2026-04-24T02:51:24.997Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=625625 decodedFrameCount=17 isPlaying=true
[2026-04-24T02:51:24.997Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=625625 frameTimestampUs=625625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:24.997Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=625625 frameTimestampUs=625625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:24.998Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=170.66666666666652
[2026-04-24T02:51:24.998Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=170.66666666666652 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:24.998Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=170.66666666666652 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.002Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=14 isPlaying=true
[2026-04-24T02:51:25.002Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.002Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.002Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.002Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=667333 seekToken=null acceptedFrameCount=19
[2026-04-24T02:51:25.002Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=667333 decodedFrameCount=18 isPlaying=true
[2026-04-24T02:51:25.002Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=667333 frameTimestampUs=667333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.002Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=667333 frameTimestampUs=667333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.006Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=170.66666666666652
[2026-04-24T02:51:25.006Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=170.66666666666652 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.006Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=170.66666666666652 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.011Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=15 isPlaying=true
[2026-04-24T02:51:25.011Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.011Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.011Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.011Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=709042 seekToken=null acceptedFrameCount=20
[2026-04-24T02:51:25.011Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=709042 decodedFrameCount=19 isPlaying=true
[2026-04-24T02:51:25.011Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=709042 frameTimestampUs=709042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.011Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=709042 frameTimestampUs=709042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.011Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.012Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=750750 seekToken=null acceptedFrameCount=21
[2026-04-24T02:51:25.012Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=750750 decodedFrameCount=20 isPlaying=true
[2026-04-24T02:51:25.012Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=750750 frameTimestampUs=750750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.012Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=750750 frameTimestampUs=750750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.016Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=181.3333333333338
[2026-04-24T02:51:25.016Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=181.3333333333338 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.016Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=181.3333333333338 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.017Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.017Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=792458 seekToken=null acceptedFrameCount=22
[2026-04-24T02:51:25.017Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=792458 decodedFrameCount=21 isPlaying=true
[2026-04-24T02:51:25.017Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=792458 frameTimestampUs=792458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.017Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=792458 frameTimestampUs=792458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.021Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=16 isPlaying=true
[2026-04-24T02:51:25.021Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.021Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.021Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.021Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=834167 seekToken=null acceptedFrameCount=23
[2026-04-24T02:51:25.021Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=834167 decodedFrameCount=22 isPlaying=true
[2026-04-24T02:51:25.021Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=834167 frameTimestampUs=834167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.021Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=834167 frameTimestampUs=834167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.022Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=192.00000000000017
[2026-04-24T02:51:25.022Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=192.00000000000017 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.022Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=192.00000000000017 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.028Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=17 isPlaying=true
[2026-04-24T02:51:25.028Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.028Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.028Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.028Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=875875 seekToken=null acceptedFrameCount=24
[2026-04-24T02:51:25.028Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=875875 decodedFrameCount=23 isPlaying=true
[2026-04-24T02:51:25.028Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=875875 frameTimestampUs=875875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.028Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=875875 frameTimestampUs=875875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.030Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.030Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=917583 seekToken=null acceptedFrameCount=25
[2026-04-24T02:51:25.030Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=917583 decodedFrameCount=24 isPlaying=true
[2026-04-24T02:51:25.030Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=917583 frameTimestampUs=917583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.030Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=917583 frameTimestampUs=917583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.033Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=202.66666666666654
[2026-04-24T02:51:25.033Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=202.66666666666654 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.033Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=202.66666666666654 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.043Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=202.66666666666654
[2026-04-24T02:51:25.043Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=202.66666666666654 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.043Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=202.66666666666654 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.044Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=2 captionBitmapVersion=18 isPlaying=true
[2026-04-24T02:51:25.044Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.044Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.046Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.046Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=959292 seekToken=null acceptedFrameCount=26
[2026-04-24T02:51:25.046Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=959292 decodedFrameCount=25 isPlaying=true
[2026-04-24T02:51:25.046Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=959292 frameTimestampUs=959292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.046Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=959292 frameTimestampUs=959292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.046Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.046Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1001000 seekToken=null acceptedFrameCount=27
[2026-04-24T02:51:25.046Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1001000 decodedFrameCount=26 isPlaying=true
[2026-04-24T02:51:25.046Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1001000 frameTimestampUs=1001000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.046Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1001000 frameTimestampUs=1001000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.046Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.046Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1042708 seekToken=null acceptedFrameCount=28
[2026-04-24T02:51:25.046Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1042708 decodedFrameCount=27 isPlaying=true
[2026-04-24T02:51:25.046Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1042708 frameTimestampUs=1042708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.046Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1042708 frameTimestampUs=1042708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.047Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=213.33333333333383
[2026-04-24T02:51:25.047Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=213.33333333333383 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.047Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=213.33333333333383 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.053Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=20 isPlaying=true
[2026-04-24T02:51:25.053Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.053Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.053Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.053Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1084417 seekToken=null acceptedFrameCount=29
[2026-04-24T02:51:25.053Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1084417 decodedFrameCount=28 isPlaying=true
[2026-04-24T02:51:25.053Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1084417 frameTimestampUs=1084417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.053Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1084417 frameTimestampUs=1084417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.054Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.054Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1126125 seekToken=null acceptedFrameCount=30
[2026-04-24T02:51:25.054Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1126125 decodedFrameCount=29 isPlaying=true
[2026-04-24T02:51:25.054Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1126125 frameTimestampUs=1126125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.054Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1126125 frameTimestampUs=1126125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.055Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=224.0000000000002
[2026-04-24T02:51:25.055Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=224.0000000000002 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.055Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=224.0000000000002 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.060Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=21 isPlaying=true
[2026-04-24T02:51:25.060Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.060Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.060Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.060Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1167833 seekToken=null acceptedFrameCount=31
[2026-04-24T02:51:25.060Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1167833 decodedFrameCount=30 isPlaying=true
[2026-04-24T02:51:25.060Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1167833 frameTimestampUs=1167833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.060Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1167833 frameTimestampUs=1167833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.063Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.063Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1209542 seekToken=null acceptedFrameCount=32
[2026-04-24T02:51:25.063Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1209542 decodedFrameCount=31 isPlaying=true
[2026-04-24T02:51:25.063Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1209542 frameTimestampUs=1209542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.063Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1209542 frameTimestampUs=1209542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.064Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=234.66666666666657
[2026-04-24T02:51:25.064Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=234.66666666666657 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.064Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=234.66666666666657 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.070Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=22 isPlaying=true
[2026-04-24T02:51:25.070Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.070Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.071Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.071Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1251250 seekToken=null acceptedFrameCount=33
[2026-04-24T02:51:25.071Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1251250 decodedFrameCount=32 isPlaying=true
[2026-04-24T02:51:25.071Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1251250 frameTimestampUs=1251250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.071Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1251250 frameTimestampUs=1251250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.072Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=245.33333333333385
[2026-04-24T02:51:25.073Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=245.33333333333385 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.073Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=245.33333333333385 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.078Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=23 isPlaying=true
[2026-04-24T02:51:25.078Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.078Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.078Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.078Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1292958 seekToken=null acceptedFrameCount=34
[2026-04-24T02:51:25.078Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1292958 decodedFrameCount=33 isPlaying=true
[2026-04-24T02:51:25.078Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1292958 frameTimestampUs=1292958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.078Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1292958 frameTimestampUs=1292958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.078Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.078Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1334667 seekToken=null acceptedFrameCount=35
[2026-04-24T02:51:25.078Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1334667 decodedFrameCount=34 isPlaying=true
[2026-04-24T02:51:25.078Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1334667 frameTimestampUs=1334667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.078Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1334667 frameTimestampUs=1334667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.080Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=245.33333333333385
[2026-04-24T02:51:25.080Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=245.33333333333385 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.080Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=245.33333333333385 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.086Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=24 isPlaying=true
[2026-04-24T02:51:25.086Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.086Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.086Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.087Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1376375 seekToken=null acceptedFrameCount=36
[2026-04-24T02:51:25.087Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1376375 decodedFrameCount=35 isPlaying=true
[2026-04-24T02:51:25.087Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1376375 frameTimestampUs=1376375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.087Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1376375 frameTimestampUs=1376375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.087Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.087Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1418083 seekToken=null acceptedFrameCount=37
[2026-04-24T02:51:25.087Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1418083 decodedFrameCount=36 isPlaying=true
[2026-04-24T02:51:25.087Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1418083 frameTimestampUs=1418083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.087Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1418083 frameTimestampUs=1418083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.089Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=256.0000000000002
[2026-04-24T02:51:25.089Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=256.0000000000002 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.089Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=256.0000000000002 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.095Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=25 isPlaying=true
[2026-04-24T02:51:25.095Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.095Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.095Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.095Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1459792 seekToken=null acceptedFrameCount=38
[2026-04-24T02:51:25.095Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1459792 decodedFrameCount=37 isPlaying=true
[2026-04-24T02:51:25.095Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1459792 frameTimestampUs=1459792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.095Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1459792 frameTimestampUs=1459792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.096Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.096Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1501500 seekToken=null acceptedFrameCount=39
[2026-04-24T02:51:25.096Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1501500 decodedFrameCount=38 isPlaying=true
[2026-04-24T02:51:25.096Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1501500 frameTimestampUs=1501500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.096Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1501500 frameTimestampUs=1501500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.097Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=266.66666666666663
[2026-04-24T02:51:25.098Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=266.66666666666663 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.098Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=266.66666666666663 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.103Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=26 isPlaying=true
[2026-04-24T02:51:25.103Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.103Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.104Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.104Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1543208 seekToken=null acceptedFrameCount=40
[2026-04-24T02:51:25.104Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1543208 decodedFrameCount=39 isPlaying=true
[2026-04-24T02:51:25.104Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1543208 frameTimestampUs=1543208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.104Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1543208 frameTimestampUs=1543208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.105Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=277.333333333333
[2026-04-24T02:51:25.105Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=277.333333333333 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.105Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=277.333333333333 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.111Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=27 isPlaying=true
[2026-04-24T02:51:25.111Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.111Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.111Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.111Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1584917 seekToken=null acceptedFrameCount=41
[2026-04-24T02:51:25.111Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1584917 decodedFrameCount=40 isPlaying=true
[2026-04-24T02:51:25.111Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1584917 frameTimestampUs=1584917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.111Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1584917 frameTimestampUs=1584917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.111Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.111Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1626625 seekToken=null acceptedFrameCount=42
[2026-04-24T02:51:25.111Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1626625 decodedFrameCount=41 isPlaying=true
[2026-04-24T02:51:25.111Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1626625 frameTimestampUs=1626625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.111Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1626625 frameTimestampUs=1626625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.113Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=288.0000000000002
[2026-04-24T02:51:25.114Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=288.0000000000002 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.114Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=288.0000000000002 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.120Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=28 isPlaying=true
[2026-04-24T02:51:25.120Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.120Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.120Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.120Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1668333 seekToken=null acceptedFrameCount=43
[2026-04-24T02:51:25.120Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1668333 decodedFrameCount=42 isPlaying=true
[2026-04-24T02:51:25.120Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1668333 frameTimestampUs=1668333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.120Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1668333 frameTimestampUs=1668333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.121Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.121Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1710042 seekToken=null acceptedFrameCount=44
[2026-04-24T02:51:25.121Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1710042 decodedFrameCount=43 isPlaying=true
[2026-04-24T02:51:25.121Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1710042 frameTimestampUs=1710042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.121Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1710042 frameTimestampUs=1710042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.122Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=288.0000000000002
[2026-04-24T02:51:25.123Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=288.0000000000002 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.123Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=288.0000000000002 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.128Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=29 isPlaying=true
[2026-04-24T02:51:25.128Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.128Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.128Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.128Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1751750 seekToken=null acceptedFrameCount=45
[2026-04-24T02:51:25.128Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1751750 decodedFrameCount=44 isPlaying=true
[2026-04-24T02:51:25.128Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1751750 frameTimestampUs=1751750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.128Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1751750 frameTimestampUs=1751750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.131Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.131Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1793458 seekToken=null acceptedFrameCount=46
[2026-04-24T02:51:25.131Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1793458 decodedFrameCount=45 isPlaying=true
[2026-04-24T02:51:25.131Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1793458 frameTimestampUs=1793458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.131Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1793458 frameTimestampUs=1793458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.131Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=298.66666666666663
[2026-04-24T02:51:25.131Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=298.66666666666663 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.131Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=298.66666666666663 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.137Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=30 isPlaying=true
[2026-04-24T02:51:25.137Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.137Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.137Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.137Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1835167 seekToken=null acceptedFrameCount=47
[2026-04-24T02:51:25.137Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1835167 decodedFrameCount=46 isPlaying=true
[2026-04-24T02:51:25.137Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1835167 frameTimestampUs=1835167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.137Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1835167 frameTimestampUs=1835167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.139Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=309.33333333333303
[2026-04-24T02:51:25.139Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=309.33333333333303 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.139Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=309.33333333333303 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.145Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=31 isPlaying=true
[2026-04-24T02:51:25.145Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.145Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.145Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.145Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1876875 seekToken=null acceptedFrameCount=48
[2026-04-24T02:51:25.145Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1876875 decodedFrameCount=47 isPlaying=true
[2026-04-24T02:51:25.145Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1876875 frameTimestampUs=1876875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.145Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1876875 frameTimestampUs=1876875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.145Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.145Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1918583 seekToken=null acceptedFrameCount=49
[2026-04-24T02:51:25.145Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1918583 decodedFrameCount=48 isPlaying=true
[2026-04-24T02:51:25.145Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1918583 frameTimestampUs=1918583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.145Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1918583 frameTimestampUs=1918583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.147Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=320.0000000000003
[2026-04-24T02:51:25.148Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=320.0000000000003 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.148Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=320.0000000000003 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.154Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=32 isPlaying=true
[2026-04-24T02:51:25.154Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.154Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.154Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.154Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1960292 seekToken=null acceptedFrameCount=50
[2026-04-24T02:51:25.154Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1960292 decodedFrameCount=49 isPlaying=true
[2026-04-24T02:51:25.154Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1960292 frameTimestampUs=1960292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.154Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=1960292 frameTimestampUs=1960292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.156Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.156Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2002000 seekToken=null acceptedFrameCount=51
[2026-04-24T02:51:25.156Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2002000 decodedFrameCount=50 isPlaying=true
[2026-04-24T02:51:25.156Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2002000 frameTimestampUs=2002000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.156Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2002000 frameTimestampUs=2002000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.156Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=320.0000000000003
[2026-04-24T02:51:25.156Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=320.0000000000003 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.156Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=320.0000000000003 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.162Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=33 isPlaying=true
[2026-04-24T02:51:25.162Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.162Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.162Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.162Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2043708 seekToken=null acceptedFrameCount=52
[2026-04-24T02:51:25.162Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2043708 decodedFrameCount=51 isPlaying=true
[2026-04-24T02:51:25.162Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2043708 frameTimestampUs=2043708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.162Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2043708 frameTimestampUs=2043708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.164Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=330.6666666666667
[2026-04-24T02:51:25.164Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=330.6666666666667 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.164Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=330.6666666666667 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.171Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=34 isPlaying=true
[2026-04-24T02:51:25.171Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.171Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.171Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=330.6666666666667
[2026-04-24T02:51:25.171Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=330.6666666666667 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.171Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=330.6666666666667 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.178Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=35 isPlaying=true
[2026-04-24T02:51:25.178Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.178Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.178Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.178Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2085417 seekToken=null acceptedFrameCount=53
[2026-04-24T02:51:25.178Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2085417 decodedFrameCount=52 isPlaying=true
[2026-04-24T02:51:25.178Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2085417 frameTimestampUs=2085417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.178Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2085417 frameTimestampUs=2085417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.178Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.178Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2127125 seekToken=null acceptedFrameCount=54
[2026-04-24T02:51:25.178Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2127125 decodedFrameCount=53 isPlaying=true
[2026-04-24T02:51:25.178Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2127125 frameTimestampUs=2127125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.178Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2127125 frameTimestampUs=2127125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.178Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.178Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2168833 seekToken=null acceptedFrameCount=55
[2026-04-24T02:51:25.178Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2168833 decodedFrameCount=54 isPlaying=true
[2026-04-24T02:51:25.178Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2168833 frameTimestampUs=2168833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.178Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2168833 frameTimestampUs=2168833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.180Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.180Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2210542 seekToken=null acceptedFrameCount=56
[2026-04-24T02:51:25.180Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2210542 decodedFrameCount=55 isPlaying=true
[2026-04-24T02:51:25.180Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2210542 frameTimestampUs=2210542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.180Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2210542 frameTimestampUs=2210542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.181Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=352.00000000000034
[2026-04-24T02:51:25.181Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=352.00000000000034 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.181Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=352.00000000000034 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.188Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=2 captionBitmapVersion=37 isPlaying=true
[2026-04-24T02:51:25.188Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.188Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.192Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=352.00000000000034
[2026-04-24T02:51:25.193Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=352.00000000000034 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.193Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=352.00000000000034 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.196Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=38 isPlaying=true
[2026-04-24T02:51:25.196Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.196Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.196Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.196Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2252250 seekToken=null acceptedFrameCount=57
[2026-04-24T02:51:25.196Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2252250 decodedFrameCount=56 isPlaying=true
[2026-04-24T02:51:25.196Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2252250 frameTimestampUs=2252250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.196Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2252250 frameTimestampUs=2252250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.196Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.196Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2293958 seekToken=null acceptedFrameCount=58
[2026-04-24T02:51:25.196Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2293958 decodedFrameCount=57 isPlaying=true
[2026-04-24T02:51:25.196Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2293958 frameTimestampUs=2293958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.196Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2293958 frameTimestampUs=2293958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.196Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.196Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2335667 seekToken=null acceptedFrameCount=59
[2026-04-24T02:51:25.196Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2335667 decodedFrameCount=58 isPlaying=true
[2026-04-24T02:51:25.196Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2335667 frameTimestampUs=2335667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.196Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2335667 frameTimestampUs=2335667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.201Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=362.6666666666667
[2026-04-24T02:51:25.202Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=362.6666666666667 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.202Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=362.6666666666667 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.205Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.205Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2377375 seekToken=null acceptedFrameCount=60
[2026-04-24T02:51:25.205Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2377375 decodedFrameCount=59 isPlaying=true
[2026-04-24T02:51:25.205Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2377375 frameTimestampUs=2377375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.205Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2377375 frameTimestampUs=2377375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.208Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=39 isPlaying=true
[2026-04-24T02:51:25.208Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.208Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.212Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=373.3333333333331
[2026-04-24T02:51:25.212Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=373.3333333333331 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.212Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=373.3333333333331 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.215Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=40 isPlaying=true
[2026-04-24T02:51:25.215Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.215Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.216Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.216Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2419083 seekToken=null acceptedFrameCount=61
[2026-04-24T02:51:25.216Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2419083 decodedFrameCount=60 isPlaying=true
[2026-04-24T02:51:25.216Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2419083 frameTimestampUs=2419083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.216Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2419083 frameTimestampUs=2419083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.216Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.216Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2460792 seekToken=null acceptedFrameCount=62
[2026-04-24T02:51:25.216Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2460792 decodedFrameCount=61 isPlaying=true
[2026-04-24T02:51:25.216Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2460792 frameTimestampUs=2460792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.216Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2460792 frameTimestampUs=2460792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.216Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.216Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2502500 seekToken=null acceptedFrameCount=63
[2026-04-24T02:51:25.216Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2502500 decodedFrameCount=62 isPlaying=true
[2026-04-24T02:51:25.216Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2502500 frameTimestampUs=2502500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.216Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2502500 frameTimestampUs=2502500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.221Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=384.00000000000034
[2026-04-24T02:51:25.221Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=384.00000000000034 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.221Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=384.00000000000034 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.222Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.222Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2544208 seekToken=null acceptedFrameCount=64
[2026-04-24T02:51:25.222Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2544208 decodedFrameCount=63 isPlaying=true
[2026-04-24T02:51:25.222Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2544208 frameTimestampUs=2544208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.222Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2544208 frameTimestampUs=2544208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.225Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=41 isPlaying=true
[2026-04-24T02:51:25.225Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.225Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.226Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=394.66666666666674
[2026-04-24T02:51:25.226Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=394.66666666666674 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.226Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=394.66666666666674 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.234Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=42 isPlaying=true
[2026-04-24T02:51:25.234Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.234Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.234Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.234Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2585917 seekToken=null acceptedFrameCount=65
[2026-04-24T02:51:25.234Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2585917 decodedFrameCount=64 isPlaying=true
[2026-04-24T02:51:25.234Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2585917 frameTimestampUs=2585917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.234Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2585917 frameTimestampUs=2585917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.234Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.234Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2627625 seekToken=null acceptedFrameCount=66
[2026-04-24T02:51:25.234Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2627625 decodedFrameCount=65 isPlaying=true
[2026-04-24T02:51:25.234Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2627625 frameTimestampUs=2627625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.234Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2627625 frameTimestampUs=2627625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.234Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.234Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2669333 seekToken=null acceptedFrameCount=67
[2026-04-24T02:51:25.234Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2669333 decodedFrameCount=66 isPlaying=true
[2026-04-24T02:51:25.234Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2669333 frameTimestampUs=2669333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.234Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2669333 frameTimestampUs=2669333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.240Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=405.3333333333331
[2026-04-24T02:51:25.240Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=405.3333333333331 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.240Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=405.3333333333331 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.241Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.241Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2711042 seekToken=null acceptedFrameCount=68
[2026-04-24T02:51:25.241Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2711042 decodedFrameCount=67 isPlaying=true
[2026-04-24T02:51:25.241Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2711042 frameTimestampUs=2711042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.241Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2711042 frameTimestampUs=2711042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.243Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=43 isPlaying=true
[2026-04-24T02:51:25.243Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.243Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.243Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=416.00000000000034
[2026-04-24T02:51:25.243Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=416.00000000000034 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.243Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=416.00000000000034 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.251Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=44 isPlaying=true
[2026-04-24T02:51:25.251Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.251Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.251Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.251Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2752750 seekToken=null acceptedFrameCount=69
[2026-04-24T02:51:25.251Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2752750 decodedFrameCount=68 isPlaying=true
[2026-04-24T02:51:25.251Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2752750 frameTimestampUs=2752750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.251Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2752750 frameTimestampUs=2752750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.251Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.251Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2794458 seekToken=null acceptedFrameCount=70
[2026-04-24T02:51:25.251Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2794458 decodedFrameCount=69 isPlaying=true
[2026-04-24T02:51:25.251Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2794458 frameTimestampUs=2794458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.251Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2794458 frameTimestampUs=2794458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.251Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=416.00000000000034
[2026-04-24T02:51:25.252Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=416.00000000000034 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.252Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=416.00000000000034 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.260Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=45 isPlaying=true
[2026-04-24T02:51:25.260Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.260Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.260Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.260Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2836167 seekToken=null acceptedFrameCount=71
[2026-04-24T02:51:25.260Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2836167 decodedFrameCount=70 isPlaying=true
[2026-04-24T02:51:25.260Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2836167 frameTimestampUs=2836167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.260Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2836167 frameTimestampUs=2836167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.260Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.260Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2877875 seekToken=null acceptedFrameCount=72
[2026-04-24T02:51:25.260Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2877875 decodedFrameCount=71 isPlaying=true
[2026-04-24T02:51:25.260Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2877875 frameTimestampUs=2877875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.260Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2877875 frameTimestampUs=2877875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.260Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=426.66666666666674
[2026-04-24T02:51:25.260Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=426.66666666666674 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.260Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=426.66666666666674 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.267Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=46 isPlaying=true
[2026-04-24T02:51:25.267Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.267Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.268Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.268Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2919583 seekToken=null acceptedFrameCount=73
[2026-04-24T02:51:25.268Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2919583 decodedFrameCount=72 isPlaying=true
[2026-04-24T02:51:25.268Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2919583 frameTimestampUs=2919583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.268Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2919583 frameTimestampUs=2919583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.268Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.268Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2961292 seekToken=null acceptedFrameCount=74
[2026-04-24T02:51:25.268Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2961292 decodedFrameCount=73 isPlaying=true
[2026-04-24T02:51:25.268Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2961292 frameTimestampUs=2961292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.268Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=2961292 frameTimestampUs=2961292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.268Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=437.33333333333314
[2026-04-24T02:51:25.268Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=437.33333333333314 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.268Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=437.33333333333314 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.276Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=47 isPlaying=true
[2026-04-24T02:51:25.276Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.276Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.277Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.277Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3003000 seekToken=null acceptedFrameCount=75
[2026-04-24T02:51:25.277Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3003000 decodedFrameCount=74 isPlaying=true
[2026-04-24T02:51:25.277Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3003000 frameTimestampUs=3003000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.277Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3003000 frameTimestampUs=3003000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.277Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=448.0000000000004
[2026-04-24T02:51:25.277Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=448.0000000000004 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.277Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=448.0000000000004 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.285Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=48 isPlaying=true
[2026-04-24T02:51:25.285Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.285Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.285Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.285Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3044708 seekToken=null acceptedFrameCount=76
[2026-04-24T02:51:25.285Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3044708 decodedFrameCount=75 isPlaying=true
[2026-04-24T02:51:25.285Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3044708 frameTimestampUs=3044708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.285Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3044708 frameTimestampUs=3044708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.285Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.285Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3086417 seekToken=null acceptedFrameCount=77
[2026-04-24T02:51:25.285Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3086417 decodedFrameCount=76 isPlaying=true
[2026-04-24T02:51:25.285Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3086417 frameTimestampUs=3086417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.285Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3086417 frameTimestampUs=3086417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.286Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=458.6666666666668
[2026-04-24T02:51:25.286Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=458.6666666666668 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.286Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=458.6666666666668 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.294Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=49 isPlaying=true
[2026-04-24T02:51:25.294Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.294Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.294Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.294Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3128125 seekToken=null acceptedFrameCount=78
[2026-04-24T02:51:25.294Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3128125 decodedFrameCount=77 isPlaying=true
[2026-04-24T02:51:25.294Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3128125 frameTimestampUs=3128125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.294Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3128125 frameTimestampUs=3128125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.294Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.294Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3169833 seekToken=null acceptedFrameCount=79
[2026-04-24T02:51:25.294Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3169833 decodedFrameCount=78 isPlaying=true
[2026-04-24T02:51:25.294Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3169833 frameTimestampUs=3169833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.294Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3169833 frameTimestampUs=3169833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.294Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=458.6666666666668
[2026-04-24T02:51:25.294Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=458.6666666666668 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.294Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=458.6666666666668 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.303Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=50 isPlaying=true
[2026-04-24T02:51:25.303Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.303Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.303Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.303Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3211542 seekToken=null acceptedFrameCount=80
[2026-04-24T02:51:25.303Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3211542 decodedFrameCount=79 isPlaying=true
[2026-04-24T02:51:25.303Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3211542 frameTimestampUs=3211542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.303Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3211542 frameTimestampUs=3211542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.303Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=469.33333333333314
[2026-04-24T02:51:25.303Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=469.33333333333314 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.303Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=469.33333333333314 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.311Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=51 isPlaying=true
[2026-04-24T02:51:25.311Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.311Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.311Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.311Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3253250 seekToken=null acceptedFrameCount=81
[2026-04-24T02:51:25.311Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3253250 decodedFrameCount=80 isPlaying=true
[2026-04-24T02:51:25.311Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3253250 frameTimestampUs=3253250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.311Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3253250 frameTimestampUs=3253250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.311Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.311Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3294958 seekToken=null acceptedFrameCount=82
[2026-04-24T02:51:25.312Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3294958 decodedFrameCount=81 isPlaying=true
[2026-04-24T02:51:25.312Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3294958 frameTimestampUs=3294958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.312Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3294958 frameTimestampUs=3294958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.312Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=480.00000000000045
[2026-04-24T02:51:25.312Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=480.00000000000045 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.312Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=480.00000000000045 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.321Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=52 isPlaying=true
[2026-04-24T02:51:25.321Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.321Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.321Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.321Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3336667 seekToken=null acceptedFrameCount=83
[2026-04-24T02:51:25.321Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3336667 decodedFrameCount=82 isPlaying=true
[2026-04-24T02:51:25.321Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3336667 frameTimestampUs=3336667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.321Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3336667 frameTimestampUs=3336667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.321Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.321Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3378375 seekToken=null acceptedFrameCount=84
[2026-04-24T02:51:25.321Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3378375 decodedFrameCount=83 isPlaying=true
[2026-04-24T02:51:25.321Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3378375 frameTimestampUs=3378375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.321Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3378375 frameTimestampUs=3378375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.321Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=490.6666666666668
[2026-04-24T02:51:25.321Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=490.6666666666668 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.321Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=490.6666666666668 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.330Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=53 isPlaying=true
[2026-04-24T02:51:25.330Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.330Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.330Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.330Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3420083 seekToken=null acceptedFrameCount=85
[2026-04-24T02:51:25.330Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3420083 decodedFrameCount=84 isPlaying=true
[2026-04-24T02:51:25.330Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3420083 frameTimestampUs=3420083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.330Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3420083 frameTimestampUs=3420083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.330Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.330Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3461792 seekToken=null acceptedFrameCount=86
[2026-04-24T02:51:25.330Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3461792 decodedFrameCount=85 isPlaying=true
[2026-04-24T02:51:25.330Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3461792 frameTimestampUs=3461792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.330Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3461792 frameTimestampUs=3461792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.331Z] [DEBUG] Reconciling decoder workers | component=DecoderPool playheadMs=501.3333333333332 trackCount=4 assetUrlCount=5 activeWorkersBefore=1
[2026-04-24T02:51:25.331Z] [DEBUG] Collected decode candidates | component=DecoderPool playheadMs=501.3333333333332 activeClipCount=1 candidateCount=1
[2026-04-24T02:51:25.331Z] [DEBUG] Selected permitted clip IDs | component=DecoderPool candidateCount=1 permittedCount=1
[2026-04-24T02:51:25.331Z] [DEBUG] Reused existing worker | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 assetUrl=https://contentai.6fd750f4a4da03765c02f275b4bd2dd0.r2.cloudflarestorage.com/testing/video-clips/feab3bd5-83b8-4973-b2e4-bfeda310a251/dev-mock-slot1-1776839074887.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=48f5c50dfaa963b2bd7548ec627b5ca3%2F20260424%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260424T025118Z&X-Amz-Expires=3600&X-Amz-Signature=24a5e476ca4137e32ff06c9217fd06a94984e865d9bd84c27e2a99e38af34939&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject
[2026-04-24T02:51:25.331Z] [DEBUG] Finished worker reconciliation | component=DecoderPool playheadMs=501.3333333333332 activeClipCount=1 candidateCount=1 permittedCount=1 activeWorkersAfter=1
[2026-04-24T02:51:25.331Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=501.3333333333332
[2026-04-24T02:51:25.331Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=501.3333333333332 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.331Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=501.3333333333332 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.339Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=54 isPlaying=true
[2026-04-24T02:51:25.339Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.339Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.339Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=501.3333333333332
[2026-04-24T02:51:25.339Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=501.3333333333332 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.339Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=501.3333333333332 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.349Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=55 isPlaying=true
[2026-04-24T02:51:25.349Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.349Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.349Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=512.0000000000005
[2026-04-24T02:51:25.349Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=512.0000000000005 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.349Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=512.0000000000005 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.356Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.356Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3503500 seekToken=null acceptedFrameCount=87
[2026-04-24T02:51:25.356Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3503500 decodedFrameCount=86 isPlaying=true
[2026-04-24T02:51:25.356Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3503500 frameTimestampUs=3503500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.356Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3503500 frameTimestampUs=3503500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.359Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=56 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.359Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.359Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.359Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3545208 seekToken=null acceptedFrameCount=88
[2026-04-24T02:51:25.359Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3545208 decodedFrameCount=87 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3545208 frameTimestampUs=3545208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.359Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3545208 frameTimestampUs=3545208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.359Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.359Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3586917 seekToken=null acceptedFrameCount=89
[2026-04-24T02:51:25.359Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3586917 decodedFrameCount=88 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3586917 frameTimestampUs=3586917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.359Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3586917 frameTimestampUs=3586917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.359Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.359Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3628625 seekToken=null acceptedFrameCount=90
[2026-04-24T02:51:25.359Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3628625 decodedFrameCount=89 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3628625 frameTimestampUs=3628625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.359Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3628625 frameTimestampUs=3628625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.359Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.359Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3670333 seekToken=null acceptedFrameCount=91
[2026-04-24T02:51:25.359Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3670333 decodedFrameCount=90 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3670333 frameTimestampUs=3670333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.359Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3670333 frameTimestampUs=3670333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.359Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.359Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3712042 seekToken=null acceptedFrameCount=92
[2026-04-24T02:51:25.359Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3712042 decodedFrameCount=91 isPlaying=true
[2026-04-24T02:51:25.359Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3712042 frameTimestampUs=3712042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.359Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3712042 frameTimestampUs=3712042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.360Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=533.3333333333333
[2026-04-24T02:51:25.360Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=533.3333333333333 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.360Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=533.3333333333333 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.369Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=57 isPlaying=true
[2026-04-24T02:51:25.369Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.369Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.369Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.369Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3753750 seekToken=null acceptedFrameCount=93
[2026-04-24T02:51:25.369Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3753750 decodedFrameCount=92 isPlaying=true
[2026-04-24T02:51:25.369Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3753750 frameTimestampUs=3753750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.369Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3753750 frameTimestampUs=3753750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.369Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.369Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3795458 seekToken=null acceptedFrameCount=94
[2026-04-24T02:51:25.369Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3795458 decodedFrameCount=93 isPlaying=true
[2026-04-24T02:51:25.369Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3795458 frameTimestampUs=3795458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.369Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3795458 frameTimestampUs=3795458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.369Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=533.3333333333333
[2026-04-24T02:51:25.369Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=533.3333333333333 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.369Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=533.3333333333333 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.379Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=58 isPlaying=true
[2026-04-24T02:51:25.379Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.379Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.379Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.379Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3837167 seekToken=null acceptedFrameCount=95
[2026-04-24T02:51:25.379Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3837167 decodedFrameCount=94 isPlaying=true
[2026-04-24T02:51:25.379Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3837167 frameTimestampUs=3837167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.379Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3837167 frameTimestampUs=3837167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.379Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.379Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3878875 seekToken=null acceptedFrameCount=96
[2026-04-24T02:51:25.379Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3878875 decodedFrameCount=95 isPlaying=true
[2026-04-24T02:51:25.379Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3878875 frameTimestampUs=3878875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.379Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3878875 frameTimestampUs=3878875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.379Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=544.0000000000005
[2026-04-24T02:51:25.380Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=544.0000000000005 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.380Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=544.0000000000005 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.391Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=59 isPlaying=true
[2026-04-24T02:51:25.391Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.391Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.398Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=544.0000000000005
[2026-04-24T02:51:25.398Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=544.0000000000005 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.398Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=544.0000000000005 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.402Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=60 isPlaying=true
[2026-04-24T02:51:25.402Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.402Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.402Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.402Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3920583 seekToken=null acceptedFrameCount=97
[2026-04-24T02:51:25.402Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3920583 decodedFrameCount=96 isPlaying=true
[2026-04-24T02:51:25.402Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3920583 frameTimestampUs=3920583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.402Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3920583 frameTimestampUs=3920583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.402Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.402Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3962292 seekToken=null acceptedFrameCount=98
[2026-04-24T02:51:25.402Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3962292 decodedFrameCount=97 isPlaying=true
[2026-04-24T02:51:25.402Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3962292 frameTimestampUs=3962292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.402Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=3962292 frameTimestampUs=3962292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.403Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.403Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4004000 seekToken=null acceptedFrameCount=99
[2026-04-24T02:51:25.403Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4004000 decodedFrameCount=98 isPlaying=true
[2026-04-24T02:51:25.403Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4004000 frameTimestampUs=4004000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.403Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4004000 frameTimestampUs=4004000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.403Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.403Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4045708 seekToken=null acceptedFrameCount=100
[2026-04-24T02:51:25.403Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4045708 decodedFrameCount=99 isPlaying=true
[2026-04-24T02:51:25.403Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4045708 frameTimestampUs=4045708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.403Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4045708 frameTimestampUs=4045708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.403Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.403Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4087417 seekToken=null acceptedFrameCount=101
[2026-04-24T02:51:25.403Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4087417 decodedFrameCount=100 isPlaying=true
[2026-04-24T02:51:25.403Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4087417 frameTimestampUs=4087417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.403Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4087417 frameTimestampUs=4087417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.409Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=576.0000000000005
[2026-04-24T02:51:25.409Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=576.0000000000005 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.409Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=576.0000000000005 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.413Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=61 isPlaying=true
[2026-04-24T02:51:25.413Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.413Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.413Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.413Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4129125 seekToken=null acceptedFrameCount=102
[2026-04-24T02:51:25.413Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4129125 decodedFrameCount=101 isPlaying=true
[2026-04-24T02:51:25.413Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4129125 frameTimestampUs=4129125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.413Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4129125 frameTimestampUs=4129125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.413Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.413Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4170833 seekToken=null acceptedFrameCount=103
[2026-04-24T02:51:25.413Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4170833 decodedFrameCount=102 isPlaying=true
[2026-04-24T02:51:25.413Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4170833 frameTimestampUs=4170833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.413Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4170833 frameTimestampUs=4170833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.421Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=586.6666666666669
[2026-04-24T02:51:25.421Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=586.6666666666669 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.421Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=586.6666666666669 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.425Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=62 isPlaying=true
[2026-04-24T02:51:25.425Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.425Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.425Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.425Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4212542 seekToken=null acceptedFrameCount=104
[2026-04-24T02:51:25.425Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4212542 decodedFrameCount=103 isPlaying=true
[2026-04-24T02:51:25.425Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4212542 frameTimestampUs=4212542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.425Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4212542 frameTimestampUs=4212542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.425Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.425Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4254250 seekToken=null acceptedFrameCount=105
[2026-04-24T02:51:25.425Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4254250 decodedFrameCount=104 isPlaying=true
[2026-04-24T02:51:25.425Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4254250 frameTimestampUs=4254250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.425Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4254250 frameTimestampUs=4254250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.425Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.425Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4295958 seekToken=null acceptedFrameCount=106
[2026-04-24T02:51:25.425Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4295958 decodedFrameCount=105 isPlaying=true
[2026-04-24T02:51:25.425Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4295958 frameTimestampUs=4295958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.425Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4295958 frameTimestampUs=4295958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.433Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=597.3333333333333
[2026-04-24T02:51:25.433Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=597.3333333333333 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.433Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=597.3333333333333 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.434Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.434Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4337667 seekToken=null acceptedFrameCount=107
[2026-04-24T02:51:25.434Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4337667 decodedFrameCount=106 isPlaying=true
[2026-04-24T02:51:25.434Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4337667 frameTimestampUs=4337667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.434Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4337667 frameTimestampUs=4337667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.435Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=63 isPlaying=true
[2026-04-24T02:51:25.435Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.435Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.436Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.436Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4379375 seekToken=null acceptedFrameCount=108
[2026-04-24T02:51:25.436Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4379375 decodedFrameCount=107 isPlaying=true
[2026-04-24T02:51:25.436Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4379375 frameTimestampUs=4379375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.436Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4379375 frameTimestampUs=4379375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.436Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=607.9999999999997
[2026-04-24T02:51:25.436Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=607.9999999999997 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.436Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=607.9999999999997 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.448Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=2 captionBitmapVersion=65 isPlaying=true
[2026-04-24T02:51:25.448Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.448Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.448Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=607.9999999999997
[2026-04-24T02:51:25.448Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=607.9999999999997 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.448Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=607.9999999999997 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.459Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=66 isPlaying=true
[2026-04-24T02:51:25.459Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.459Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.459Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.459Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4421083 seekToken=null acceptedFrameCount=109
[2026-04-24T02:51:25.459Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4421083 decodedFrameCount=108 isPlaying=true
[2026-04-24T02:51:25.459Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4421083 frameTimestampUs=4421083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.459Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4421083 frameTimestampUs=4421083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.459Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.459Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4462792 seekToken=null acceptedFrameCount=110
[2026-04-24T02:51:25.459Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4462792 decodedFrameCount=109 isPlaying=true
[2026-04-24T02:51:25.459Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4462792 frameTimestampUs=4462792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.459Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4462792 frameTimestampUs=4462792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.460Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.460Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4504500 seekToken=null acceptedFrameCount=111
[2026-04-24T02:51:25.460Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4504500 decodedFrameCount=110 isPlaying=true
[2026-04-24T02:51:25.460Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4504500 frameTimestampUs=4504500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.460Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4504500 frameTimestampUs=4504500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.460Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.460Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4546208 seekToken=null acceptedFrameCount=112
[2026-04-24T02:51:25.460Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4546208 decodedFrameCount=111 isPlaying=true
[2026-04-24T02:51:25.460Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4546208 frameTimestampUs=4546208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.460Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4546208 frameTimestampUs=4546208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.460Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.460Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4587917 seekToken=null acceptedFrameCount=113
[2026-04-24T02:51:25.460Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4587917 decodedFrameCount=112 isPlaying=true
[2026-04-24T02:51:25.460Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4587917 frameTimestampUs=4587917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.460Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4587917 frameTimestampUs=4587917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.460Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=629.3333333333333
[2026-04-24T02:51:25.460Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=629.3333333333333 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.460Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=629.3333333333333 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.471Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=67 isPlaying=true
[2026-04-24T02:51:25.471Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.471Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.471Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.471Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4629625 seekToken=null acceptedFrameCount=114
[2026-04-24T02:51:25.471Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4629625 decodedFrameCount=113 isPlaying=true
[2026-04-24T02:51:25.471Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4629625 frameTimestampUs=4629625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.471Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4629625 frameTimestampUs=4629625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.471Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.471Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4671333 seekToken=null acceptedFrameCount=115
[2026-04-24T02:51:25.471Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4671333 decodedFrameCount=114 isPlaying=true
[2026-04-24T02:51:25.471Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4671333 frameTimestampUs=4671333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.471Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4671333 frameTimestampUs=4671333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.471Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=639.9999999999997
[2026-04-24T02:51:25.471Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=639.9999999999997 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.471Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=639.9999999999997 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.483Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=68 isPlaying=true
[2026-04-24T02:51:25.483Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.483Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.483Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=639.9999999999997
[2026-04-24T02:51:25.483Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=639.9999999999997 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.483Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=639.9999999999997 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.495Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=69 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.495Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.495Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.495Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4713042 seekToken=null acceptedFrameCount=116
[2026-04-24T02:51:25.495Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4713042 decodedFrameCount=115 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4713042 frameTimestampUs=4713042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4713042 frameTimestampUs=4713042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.495Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.495Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4754750 seekToken=null acceptedFrameCount=117
[2026-04-24T02:51:25.495Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4754750 decodedFrameCount=116 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4754750 frameTimestampUs=4754750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4754750 frameTimestampUs=4754750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.495Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.495Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4796458 seekToken=null acceptedFrameCount=118
[2026-04-24T02:51:25.495Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4796458 decodedFrameCount=117 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4796458 frameTimestampUs=4796458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4796458 frameTimestampUs=4796458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.495Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.495Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4838167 seekToken=null acceptedFrameCount=119
[2026-04-24T02:51:25.495Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4838167 decodedFrameCount=118 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4838167 frameTimestampUs=4838167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4838167 frameTimestampUs=4838167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.495Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.495Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4879875 seekToken=null acceptedFrameCount=120
[2026-04-24T02:51:25.495Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4879875 decodedFrameCount=119 isPlaying=true
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4879875 frameTimestampUs=4879875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4879875 frameTimestampUs=4879875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.495Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=661.3333333333334
[2026-04-24T02:51:25.495Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=661.3333333333334 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.495Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=661.3333333333334 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.507Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=70 isPlaying=true
[2026-04-24T02:51:25.507Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.507Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.507Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=661.3333333333334
[2026-04-24T02:51:25.507Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=661.3333333333334 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.507Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=661.3333333333334 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.520Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=71 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.520Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.520Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.520Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4921583 seekToken=null acceptedFrameCount=121
[2026-04-24T02:51:25.520Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4921583 decodedFrameCount=120 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4921583 frameTimestampUs=4921583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.520Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4921583 frameTimestampUs=4921583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.520Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.520Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4963292 seekToken=null acceptedFrameCount=122
[2026-04-24T02:51:25.520Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4963292 decodedFrameCount=121 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4963292 frameTimestampUs=4963292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.520Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=4963292 frameTimestampUs=4963292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.520Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.520Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5005000 seekToken=null acceptedFrameCount=123
[2026-04-24T02:51:25.520Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5005000 decodedFrameCount=122 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5005000 frameTimestampUs=5005000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.520Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5005000 frameTimestampUs=5005000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.520Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.520Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5046708 seekToken=null acceptedFrameCount=124
[2026-04-24T02:51:25.520Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5046708 decodedFrameCount=123 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5046708 frameTimestampUs=5046708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.520Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5046708 frameTimestampUs=5046708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.520Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.520Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5088417 seekToken=null acceptedFrameCount=125
[2026-04-24T02:51:25.520Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5088417 decodedFrameCount=124 isPlaying=true
[2026-04-24T02:51:25.520Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5088417 frameTimestampUs=5088417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.520Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5088417 frameTimestampUs=5088417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.520Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=693.3333333333334
[2026-04-24T02:51:25.521Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=693.3333333333334 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.521Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=693.3333333333334 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.532Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=72 isPlaying=true
[2026-04-24T02:51:25.532Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.532Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.532Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=693.3333333333334
[2026-04-24T02:51:25.532Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=693.3333333333334 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.532Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=693.3333333333334 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.544Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=73 isPlaying=true
[2026-04-24T02:51:25.544Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.544Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.544Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.544Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5130125 seekToken=null acceptedFrameCount=126
[2026-04-24T02:51:25.545Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5130125 decodedFrameCount=125 isPlaying=true
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5130125 frameTimestampUs=5130125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5130125 frameTimestampUs=5130125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.545Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.545Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5171833 seekToken=null acceptedFrameCount=127
[2026-04-24T02:51:25.545Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5171833 decodedFrameCount=126 isPlaying=true
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5171833 frameTimestampUs=5171833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5171833 frameTimestampUs=5171833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.545Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.545Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5213542 seekToken=null acceptedFrameCount=128
[2026-04-24T02:51:25.545Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5213542 decodedFrameCount=127 isPlaying=true
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5213542 frameTimestampUs=5213542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5213542 frameTimestampUs=5213542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.545Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.545Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5255250 seekToken=null acceptedFrameCount=129
[2026-04-24T02:51:25.545Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5255250 decodedFrameCount=128 isPlaying=true
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5255250 frameTimestampUs=5255250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5255250 frameTimestampUs=5255250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.545Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.545Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5296958 seekToken=null acceptedFrameCount=130
[2026-04-24T02:51:25.545Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5296958 decodedFrameCount=129 isPlaying=true
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5296958 frameTimestampUs=5296958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5296958 frameTimestampUs=5296958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.545Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=714.666666666667
[2026-04-24T02:51:25.545Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=714.666666666667 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.545Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=714.666666666667 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.557Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=74 isPlaying=true
[2026-04-24T02:51:25.557Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.557Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.557Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=714.666666666667
[2026-04-24T02:51:25.558Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=714.666666666667 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.558Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=714.666666666667 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.570Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=75 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.570Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.570Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.570Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5338667 seekToken=null acceptedFrameCount=131
[2026-04-24T02:51:25.570Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5338667 decodedFrameCount=130 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5338667 frameTimestampUs=5338667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5338667 frameTimestampUs=5338667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.570Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.570Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5380375 seekToken=null acceptedFrameCount=132
[2026-04-24T02:51:25.570Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5380375 decodedFrameCount=131 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5380375 frameTimestampUs=5380375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5380375 frameTimestampUs=5380375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.570Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.570Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5422083 seekToken=null acceptedFrameCount=133
[2026-04-24T02:51:25.570Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5422083 decodedFrameCount=132 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5422083 frameTimestampUs=5422083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5422083 frameTimestampUs=5422083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.570Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.570Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5463792 seekToken=null acceptedFrameCount=134
[2026-04-24T02:51:25.570Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5463792 decodedFrameCount=133 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5463792 frameTimestampUs=5463792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5463792 frameTimestampUs=5463792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.570Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.570Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5505500 seekToken=null acceptedFrameCount=135
[2026-04-24T02:51:25.570Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5505500 decodedFrameCount=134 isPlaying=true
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5505500 frameTimestampUs=5505500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5505500 frameTimestampUs=5505500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.570Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=735.9999999999998
[2026-04-24T02:51:25.570Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=735.9999999999998 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.570Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=735.9999999999998 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.583Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=76 isPlaying=true
[2026-04-24T02:51:25.583Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.583Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.583Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=735.9999999999998
[2026-04-24T02:51:25.583Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=735.9999999999998 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.583Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=735.9999999999998 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.596Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=77 isPlaying=true
[2026-04-24T02:51:25.596Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.596Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.596Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.596Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5547208 seekToken=null acceptedFrameCount=136
[2026-04-24T02:51:25.596Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5547208 decodedFrameCount=135 isPlaying=true
[2026-04-24T02:51:25.596Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5547208 frameTimestampUs=5547208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.596Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5547208 frameTimestampUs=5547208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.597Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5588917 seekToken=null acceptedFrameCount=137
[2026-04-24T02:51:25.597Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5588917 decodedFrameCount=136 isPlaying=true
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5588917 frameTimestampUs=5588917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5588917 frameTimestampUs=5588917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.597Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5630625 seekToken=null acceptedFrameCount=138
[2026-04-24T02:51:25.597Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5630625 decodedFrameCount=137 isPlaying=true
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5630625 frameTimestampUs=5630625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5630625 frameTimestampUs=5630625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.597Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5672333 seekToken=null acceptedFrameCount=139
[2026-04-24T02:51:25.597Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5672333 decodedFrameCount=138 isPlaying=true
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5672333 frameTimestampUs=5672333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5672333 frameTimestampUs=5672333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.597Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5714042 seekToken=null acceptedFrameCount=140
[2026-04-24T02:51:25.597Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5714042 decodedFrameCount=139 isPlaying=true
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5714042 frameTimestampUs=5714042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5714042 frameTimestampUs=5714042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.597Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5755750 seekToken=null acceptedFrameCount=141
[2026-04-24T02:51:25.597Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5755750 decodedFrameCount=140 isPlaying=true
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5755750 frameTimestampUs=5755750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5755750 frameTimestampUs=5755750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.597Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=767.9999999999998
[2026-04-24T02:51:25.597Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=767.9999999999998 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.597Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=767.9999999999998 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.610Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=78 isPlaying=true
[2026-04-24T02:51:25.610Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.610Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.610Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.610Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5797458 seekToken=null acceptedFrameCount=142
[2026-04-24T02:51:25.610Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5797458 decodedFrameCount=141 isPlaying=true
[2026-04-24T02:51:25.610Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5797458 frameTimestampUs=5797458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.610Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5797458 frameTimestampUs=5797458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.610Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.610Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5839167 seekToken=null acceptedFrameCount=143
[2026-04-24T02:51:25.610Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5839167 decodedFrameCount=142 isPlaying=true
[2026-04-24T02:51:25.610Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5839167 frameTimestampUs=5839167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.610Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5839167 frameTimestampUs=5839167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.620Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=778.6666666666671
[2026-04-24T02:51:25.620Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=778.6666666666671 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.620Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=778.6666666666671 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.624Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=79 isPlaying=true
[2026-04-24T02:51:25.624Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.624Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.624Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.624Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5880875 seekToken=null acceptedFrameCount=144
[2026-04-24T02:51:25.624Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5880875 decodedFrameCount=143 isPlaying=true
[2026-04-24T02:51:25.624Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5880875 frameTimestampUs=5880875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.624Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5880875 frameTimestampUs=5880875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.624Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.624Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5922583 seekToken=null acceptedFrameCount=145
[2026-04-24T02:51:25.624Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5922583 decodedFrameCount=144 isPlaying=true
[2026-04-24T02:51:25.624Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5922583 frameTimestampUs=5922583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.624Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5922583 frameTimestampUs=5922583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.624Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.624Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5964292 seekToken=null acceptedFrameCount=146
[2026-04-24T02:51:25.624Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5964292 decodedFrameCount=145 isPlaying=true
[2026-04-24T02:51:25.624Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5964292 frameTimestampUs=5964292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.624Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=5964292 frameTimestampUs=5964292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.624Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=789.3333333333335
[2026-04-24T02:51:25.624Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=789.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.624Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=789.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.641Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=80 isPlaying=true
[2026-04-24T02:51:25.641Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.641Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.642Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=789.3333333333335
[2026-04-24T02:51:25.642Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=789.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.642Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=789.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.655Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=81 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.655Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6006000 seekToken=null acceptedFrameCount=147
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6006000 decodedFrameCount=146 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6006000 frameTimestampUs=6006000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6006000 frameTimestampUs=6006000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6047708 seekToken=null acceptedFrameCount=148
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6047708 decodedFrameCount=147 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6047708 frameTimestampUs=6047708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6047708 frameTimestampUs=6047708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6089417 seekToken=null acceptedFrameCount=149
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6089417 decodedFrameCount=148 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6089417 frameTimestampUs=6089417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6089417 frameTimestampUs=6089417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6131125 seekToken=null acceptedFrameCount=150
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6131125 decodedFrameCount=149 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6131125 frameTimestampUs=6131125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6131125 frameTimestampUs=6131125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6172833 seekToken=null acceptedFrameCount=151
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6172833 decodedFrameCount=150 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6172833 frameTimestampUs=6172833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6172833 frameTimestampUs=6172833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6214542 seekToken=null acceptedFrameCount=152
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6214542 decodedFrameCount=151 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6214542 frameTimestampUs=6214542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6214542 frameTimestampUs=6214542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.655Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6256250 seekToken=null acceptedFrameCount=153
[2026-04-24T02:51:25.655Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6256250 decodedFrameCount=152 isPlaying=true
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6256250 frameTimestampUs=6256250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6256250 frameTimestampUs=6256250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.655Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=821.3333333333335
[2026-04-24T02:51:25.655Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=821.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.655Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=821.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.668Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=82 isPlaying=true
[2026-04-24T02:51:25.668Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.668Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.668Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.668Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6297958 seekToken=null acceptedFrameCount=154
[2026-04-24T02:51:25.668Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6297958 decodedFrameCount=153 isPlaying=true
[2026-04-24T02:51:25.668Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6297958 frameTimestampUs=6297958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.668Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6297958 frameTimestampUs=6297958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.668Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.668Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6339667 seekToken=null acceptedFrameCount=155
[2026-04-24T02:51:25.668Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6339667 decodedFrameCount=154 isPlaying=true
[2026-04-24T02:51:25.668Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6339667 frameTimestampUs=6339667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.668Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6339667 frameTimestampUs=6339667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.669Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=842.6666666666671
[2026-04-24T02:51:25.670Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=842.6666666666671 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.670Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=842.6666666666671 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.683Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=83 isPlaying=true
[2026-04-24T02:51:25.683Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.683Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.683Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.683Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6381375 seekToken=null acceptedFrameCount=156
[2026-04-24T02:51:25.683Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6381375 decodedFrameCount=155 isPlaying=true
[2026-04-24T02:51:25.683Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6381375 frameTimestampUs=6381375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.683Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6381375 frameTimestampUs=6381375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.683Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.683Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6423083 seekToken=null acceptedFrameCount=157
[2026-04-24T02:51:25.683Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6423083 decodedFrameCount=156 isPlaying=true
[2026-04-24T02:51:25.683Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6423083 frameTimestampUs=6423083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.683Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6423083 frameTimestampUs=6423083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.683Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.683Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6464792 seekToken=null acceptedFrameCount=158
[2026-04-24T02:51:25.683Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6464792 decodedFrameCount=157 isPlaying=true
[2026-04-24T02:51:25.683Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6464792 frameTimestampUs=6464792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.683Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6464792 frameTimestampUs=6464792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.683Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=853.3333333333335
[2026-04-24T02:51:25.683Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=853.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.683Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=853.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.697Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=84 isPlaying=true
[2026-04-24T02:51:25.697Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.697Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.698Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=853.3333333333335
[2026-04-24T02:51:25.698Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=853.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.698Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=853.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.711Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=85 isPlaying=true
[2026-04-24T02:51:25.711Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.711Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6506500 seekToken=null acceptedFrameCount=159
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6506500 decodedFrameCount=158 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6506500 frameTimestampUs=6506500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6506500 frameTimestampUs=6506500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6548208 seekToken=null acceptedFrameCount=160
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6548208 decodedFrameCount=159 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6548208 frameTimestampUs=6548208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6548208 frameTimestampUs=6548208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6589917 seekToken=null acceptedFrameCount=161
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6589917 decodedFrameCount=160 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6589917 frameTimestampUs=6589917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6589917 frameTimestampUs=6589917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6631625 seekToken=null acceptedFrameCount=162
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6631625 decodedFrameCount=161 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6631625 frameTimestampUs=6631625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6631625 frameTimestampUs=6631625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6673333 seekToken=null acceptedFrameCount=163
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6673333 decodedFrameCount=162 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6673333 frameTimestampUs=6673333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6673333 frameTimestampUs=6673333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.713Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.713Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6715042 seekToken=null acceptedFrameCount=164
[2026-04-24T02:51:25.713Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6715042 decodedFrameCount=163 isPlaying=true
[2026-04-24T02:51:25.713Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6715042 frameTimestampUs=6715042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.713Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6715042 frameTimestampUs=6715042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.714Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=885.3333333333335
[2026-04-24T02:51:25.714Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=885.3333333333335 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.714Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=885.3333333333335 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.728Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=2 captionBitmapVersion=87 isPlaying=true
[2026-04-24T02:51:25.728Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.728Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.728Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.728Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6756750 seekToken=null acceptedFrameCount=165
[2026-04-24T02:51:25.728Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6756750 decodedFrameCount=164 isPlaying=true
[2026-04-24T02:51:25.728Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6756750 frameTimestampUs=6756750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.728Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6756750 frameTimestampUs=6756750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.728Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.728Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6798458 seekToken=null acceptedFrameCount=166
[2026-04-24T02:51:25.728Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6798458 decodedFrameCount=165 isPlaying=true
[2026-04-24T02:51:25.728Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6798458 frameTimestampUs=6798458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.728Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6798458 frameTimestampUs=6798458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.728Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.728Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6840167 seekToken=null acceptedFrameCount=167
[2026-04-24T02:51:25.728Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6840167 decodedFrameCount=166 isPlaying=true
[2026-04-24T02:51:25.728Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6840167 frameTimestampUs=6840167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.728Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6840167 frameTimestampUs=6840167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.728Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=895.9999999999999
[2026-04-24T02:51:25.728Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=895.9999999999999 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.728Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=895.9999999999999 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.744Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=88 isPlaying=true
[2026-04-24T02:51:25.744Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.744Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.744Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.744Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6881875 seekToken=null acceptedFrameCount=168
[2026-04-24T02:51:25.744Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6881875 decodedFrameCount=167 isPlaying=true
[2026-04-24T02:51:25.744Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6881875 frameTimestampUs=6881875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.744Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6881875 frameTimestampUs=6881875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.744Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.744Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6923583 seekToken=null acceptedFrameCount=169
[2026-04-24T02:51:25.744Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6923583 decodedFrameCount=168 isPlaying=true
[2026-04-24T02:51:25.744Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6923583 frameTimestampUs=6923583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.744Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6923583 frameTimestampUs=6923583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.744Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.744Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6965292 seekToken=null acceptedFrameCount=170
[2026-04-24T02:51:25.744Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6965292 decodedFrameCount=169 isPlaying=true
[2026-04-24T02:51:25.744Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6965292 frameTimestampUs=6965292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.744Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=6965292 frameTimestampUs=6965292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.744Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.744Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7007000 seekToken=null acceptedFrameCount=171
[2026-04-24T02:51:25.744Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7007000 decodedFrameCount=170 isPlaying=true
[2026-04-24T02:51:25.744Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7007000 frameTimestampUs=7007000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.744Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7007000 frameTimestampUs=7007000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.744Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=917.3333333333336
[2026-04-24T02:51:25.745Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=917.3333333333336 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.745Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=917.3333333333336 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.760Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=89 isPlaying=true
[2026-04-24T02:51:25.760Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.760Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.760Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.760Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7048708 seekToken=null acceptedFrameCount=172
[2026-04-24T02:51:25.760Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7048708 decodedFrameCount=171 isPlaying=true
[2026-04-24T02:51:25.760Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7048708 frameTimestampUs=7048708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.760Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7048708 frameTimestampUs=7048708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.760Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.760Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7090417 seekToken=null acceptedFrameCount=173
[2026-04-24T02:51:25.760Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7090417 decodedFrameCount=172 isPlaying=true
[2026-04-24T02:51:25.760Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7090417 frameTimestampUs=7090417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.760Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7090417 frameTimestampUs=7090417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.760Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.760Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7132125 seekToken=null acceptedFrameCount=174
[2026-04-24T02:51:25.760Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7132125 decodedFrameCount=173 isPlaying=true
[2026-04-24T02:51:25.760Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7132125 frameTimestampUs=7132125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.760Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7132125 frameTimestampUs=7132125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.760Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=927.9999999999999
[2026-04-24T02:51:25.761Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=927.9999999999999 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.761Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=927.9999999999999 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.775Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=90 isPlaying=true
[2026-04-24T02:51:25.775Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.775Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.775Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.775Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7173833 seekToken=null acceptedFrameCount=175
[2026-04-24T02:51:25.775Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7173833 decodedFrameCount=174 isPlaying=true
[2026-04-24T02:51:25.775Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7173833 frameTimestampUs=7173833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.775Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7173833 frameTimestampUs=7173833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.775Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.775Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7215542 seekToken=null acceptedFrameCount=176
[2026-04-24T02:51:25.775Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7215542 decodedFrameCount=175 isPlaying=true
[2026-04-24T02:51:25.775Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7215542 frameTimestampUs=7215542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.775Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7215542 frameTimestampUs=7215542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.775Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.775Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7257250 seekToken=null acceptedFrameCount=177
[2026-04-24T02:51:25.775Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7257250 decodedFrameCount=176 isPlaying=true
[2026-04-24T02:51:25.775Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7257250 frameTimestampUs=7257250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.775Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7257250 frameTimestampUs=7257250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.776Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=949.3333333333336
[2026-04-24T02:51:25.776Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=949.3333333333336 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.776Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=949.3333333333336 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.791Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=91 isPlaying=true
[2026-04-24T02:51:25.791Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.791Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.791Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=949.3333333333336
[2026-04-24T02:51:25.791Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=949.3333333333336 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.791Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=949.3333333333336 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.807Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=92 isPlaying=true
[2026-04-24T02:51:25.807Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.807Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.819Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=970.6666666666663
[2026-04-24T02:51:25.819Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=970.6666666666663 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.819Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=970.6666666666663 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.821Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.821Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7298958 seekToken=null acceptedFrameCount=178
[2026-04-24T02:51:25.821Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7298958 decodedFrameCount=177 isPlaying=true
[2026-04-24T02:51:25.821Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7298958 frameTimestampUs=7298958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.821Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7298958 frameTimestampUs=7298958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.823Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=93 isPlaying=true
[2026-04-24T02:51:25.823Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.823Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.824Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=992
[2026-04-24T02:51:25.824Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=992 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.824Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=992 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.836Z] [DEBUG] Priming audio context | component=PreviewEngine
[2026-04-24T02:51:25.839Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=94 isPlaying=true
[2026-04-24T02:51:25.839Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.839Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.839Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=992
[2026-04-24T02:51:25.840Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=992 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.840Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=992 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.856Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=95 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.856Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7340667 seekToken=null acceptedFrameCount=179
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7340667 decodedFrameCount=178 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7340667 frameTimestampUs=7340667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7340667 frameTimestampUs=7340667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7382375 seekToken=null acceptedFrameCount=180
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7382375 decodedFrameCount=179 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7382375 frameTimestampUs=7382375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7382375 frameTimestampUs=7382375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7424083 seekToken=null acceptedFrameCount=181
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7424083 decodedFrameCount=180 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7424083 frameTimestampUs=7424083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7424083 frameTimestampUs=7424083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7465792 seekToken=null acceptedFrameCount=182
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7465792 decodedFrameCount=181 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7465792 frameTimestampUs=7465792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7465792 frameTimestampUs=7465792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7507500 seekToken=null acceptedFrameCount=183
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7507500 decodedFrameCount=182 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7507500 frameTimestampUs=7507500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7507500 frameTimestampUs=7507500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7549208 seekToken=null acceptedFrameCount=184
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7549208 decodedFrameCount=183 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7549208 frameTimestampUs=7549208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7549208 frameTimestampUs=7549208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.856Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.856Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7590917 seekToken=null acceptedFrameCount=185
[2026-04-24T02:51:25.856Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7590917 decodedFrameCount=184 isPlaying=true
[2026-04-24T02:51:25.856Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7590917 frameTimestampUs=7590917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.856Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7590917 frameTimestampUs=7590917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7632625 seekToken=null acceptedFrameCount=186
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7632625 decodedFrameCount=185 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7632625 frameTimestampUs=7632625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7632625 frameTimestampUs=7632625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7674333 seekToken=null acceptedFrameCount=187
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7674333 decodedFrameCount=186 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7674333 frameTimestampUs=7674333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7674333 frameTimestampUs=7674333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7716042 seekToken=null acceptedFrameCount=188
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7716042 decodedFrameCount=187 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7716042 frameTimestampUs=7716042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7716042 frameTimestampUs=7716042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7757750 seekToken=null acceptedFrameCount=189
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7757750 decodedFrameCount=188 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7757750 frameTimestampUs=7757750 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7757750 frameTimestampUs=7757750 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7799458 seekToken=null acceptedFrameCount=190
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7799458 decodedFrameCount=189 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7799458 frameTimestampUs=7799458 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7799458 frameTimestampUs=7799458 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7841167 seekToken=null acceptedFrameCount=191
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7841167 decodedFrameCount=190 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7841167 frameTimestampUs=7841167 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7841167 frameTimestampUs=7841167 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7882875 seekToken=null acceptedFrameCount=192
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7882875 decodedFrameCount=191 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7882875 frameTimestampUs=7882875 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7882875 frameTimestampUs=7882875 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.857Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.857Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7924583 seekToken=null acceptedFrameCount=193
[2026-04-24T02:51:25.857Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7924583 decodedFrameCount=192 isPlaying=true
[2026-04-24T02:51:25.857Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7924583 frameTimestampUs=7924583 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.857Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7924583 frameTimestampUs=7924583 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.869Z] [DEBUG] Reconciling decoder workers | component=DecoderPool playheadMs=1024 trackCount=4 assetUrlCount=5 activeWorkersBefore=1
[2026-04-24T02:51:25.869Z] [DEBUG] Collected decode candidates | component=DecoderPool playheadMs=1024 activeClipCount=1 candidateCount=1
[2026-04-24T02:51:25.869Z] [DEBUG] Selected permitted clip IDs | component=DecoderPool candidateCount=1 permittedCount=1
[2026-04-24T02:51:25.869Z] [DEBUG] Reused existing worker | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 assetUrl=https://contentai.6fd750f4a4da03765c02f275b4bd2dd0.r2.cloudflarestorage.com/testing/video-clips/feab3bd5-83b8-4973-b2e4-bfeda310a251/dev-mock-slot1-1776839074887.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=48f5c50dfaa963b2bd7548ec627b5ca3%2F20260424%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260424T025118Z&X-Amz-Expires=3600&X-Amz-Signature=24a5e476ca4137e32ff06c9217fd06a94984e865d9bd84c27e2a99e38af34939&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject
[2026-04-24T02:51:25.869Z] [DEBUG] Finished worker reconciliation | component=DecoderPool playheadMs=1024 activeClipCount=1 candidateCount=1 permittedCount=1 activeWorkersAfter=1
[2026-04-24T02:51:25.869Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=1024
[2026-04-24T02:51:25.869Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1024 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.869Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1024 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.871Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.871Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7966292 seekToken=null acceptedFrameCount=194
[2026-04-24T02:51:25.871Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7966292 decodedFrameCount=193 isPlaying=true
[2026-04-24T02:51:25.871Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7966292 frameTimestampUs=7966292 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.871Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=7966292 frameTimestampUs=7966292 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.874Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=96 isPlaying=true
[2026-04-24T02:51:25.874Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.874Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.874Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=1045.3333333333337
[2026-04-24T02:51:25.874Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1045.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.874Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1045.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.890Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=97 isPlaying=true
[2026-04-24T02:51:25.890Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.890Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.904Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=1045.3333333333337
[2026-04-24T02:51:25.904Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1045.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.904Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1045.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.907Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=98 isPlaying=true
[2026-04-24T02:51:25.907Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.907Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.907Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=1077.3333333333337
[2026-04-24T02:51:25.907Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.907Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.921Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.921Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8008000 seekToken=null acceptedFrameCount=195
[2026-04-24T02:51:25.921Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8008000 decodedFrameCount=194 isPlaying=true
[2026-04-24T02:51:25.921Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8008000 frameTimestampUs=8008000 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.921Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8008000 frameTimestampUs=8008000 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.924Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=99 isPlaying=true
[2026-04-24T02:51:25.924Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.924Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.924Z] [DEBUG] Received render tick from preview engine | component=usePreviewEngine playheadMs=1077.3333333333337
[2026-04-24T02:51:25.924Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.924Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.946Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=99 isPlaying=false
[2026-04-24T02:51:25.946Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.946Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.946Z] [DEBUG] Rendering current frame | component=PreviewEngine currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.947Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.947Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.947Z] [DEBUG] Pausing playback | component=PreviewEngine isPlaying=true currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.947Z] [DEBUG] Stopped RAF loop | component=PreviewEngine
[2026-04-24T02:51:25.947Z] [DEBUG] Entering pause mode | component=DecoderPool workerCount=1
[2026-04-24T02:51:25.947Z] [DEBUG] Posted PAUSE to worker | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37
[2026-04-24T02:51:25.947Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.947Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.947Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.948Z] [DEBUG] Collected decoder pool metrics | component=DecoderPool activeDecoderCount=1 readyDecoderCount=1 seekingDecoderCount=0 pendingSeekCount=0 metadataCacheEntries=1
[2026-04-24T02:51:25.948Z] [INFO] Playback metric payload | component=PreviewEngine {"seekCount":0,"decodedFrameCount":194,"droppedFrameCount":0,"compositorFrameMs":0,"reactPublishMs":0,"audioClockDriftMs":64.33333333333371,"decoderBudgetReason":"steady","previewQuality":{"level":"full","scale":1,"disableEffects":false,"reason":"steady"},"lastSeekLatency":null,"decoderPool":{"activeDecoderCount":1,"maxActiveDecoderCount":4,"decodeWindowMs":5000,"readyDecoderCount":1,"seekingDecoderCount":0,"pendingSeekCount":0,"assetWorkerCounts":{"https://contentai.6fd750f4a4da03765c02f275b4bd2dd0.r2.cloudflarestorage.com/testing/video-clips/feab3bd5-83b8-4973-b2e4-bfeda310a251/dev-mock-slot1-1776839074887.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=48f5c50dfaa963b2bd7548ec627b5ca3%2F20260424%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260424T025118Z&X-Amz-Expires=3600&X-Amz-Signature=24a5e476ca4137e32ff06c9217fd06a94984e865d9bd84c27e2a99e38af34939&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject":1},"maxWorkersPerAssetUrl":1,"metadataCache":{"entryCount":1,"assetUrls":["https://contentai.6fd750f4a4da03765c02f275b4bd2dd0.r2.cloudflarestorage.com/testing/video-clips/feab3bd5-83b8-4973-b2e4-bfeda310a251/dev-mock-slot1-1776839074887.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=48f5c50dfaa963b2bd7548ec627b5ca3%2F20260424%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260424T025118Z&X-Amz-Expires=3600&X-Amz-Signature=24a5e476ca4137e32ff06c9217fd06a94984e865d9bd84c27e2a99e38af34939&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"]},"clipSeekMetrics":{"460a4827-bb0d-4620-bd21-7c7cba820b37":{"lastRequestedAtMs":8173,"lastTargetMs":0,"lastFirstAcceptedFrameMs":8,"staleFrameDropCount":0,"acceptedFrameCount":195}},"clipIds":["460a4827-bb0d-4620-bd21-7c7cba820b37"]}}
[2026-04-24T02:51:25.948Z] [DEBUG] Playback paused | component=PreviewEngine currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.956Z] [DEBUG] Processing queued caption bitmaps | component=usePreviewEngine queuedBitmapCount=1 captionBitmapVersion=101 isPlaying=false
[2026-04-24T02:51:25.956Z] [DEBUG] Clearing caption frame on preview engine | component=usePreviewEngine
[2026-04-24T02:51:25.956Z] [DEBUG] Updated pending caption frame | component=PreviewEngine action=clear
[2026-04-24T02:51:25.956Z] [DEBUG] Rendering current frame | component=PreviewEngine currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=false previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=clear previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.957Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=true previewQuality=full
[2026-04-24T02:51:25.957Z] [DEBUG] Setting initial current time on preview engine | component=usePreviewEngine currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.957Z] [DEBUG] Set current time | component=PreviewEngine requestedMs=1077.3333333333337 currentTimeMs=1077.3333333333337
[2026-04-24T02:51:25.957Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.957Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8049708 seekToken=null acceptedFrameCount=196
[2026-04-24T02:51:25.957Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8049708 decodedFrameCount=195 isPlaying=false
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8049708 frameTimestampUs=8049708 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8049708 frameTimestampUs=8049708 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.957Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.957Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.957Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8091417 seekToken=null acceptedFrameCount=197
[2026-04-24T02:51:25.957Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8091417 decodedFrameCount=196 isPlaying=false
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8091417 frameTimestampUs=8091417 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8091417 frameTimestampUs=8091417 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.957Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.957Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.957Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8133125 seekToken=null acceptedFrameCount=198
[2026-04-24T02:51:25.957Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8133125 decodedFrameCount=197 isPlaying=false
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8133125 frameTimestampUs=8133125 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8133125 frameTimestampUs=8133125 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.957Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.957Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.957Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.957Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.957Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8174833 seekToken=null acceptedFrameCount=199
[2026-04-24T02:51:25.958Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8174833 decodedFrameCount=198 isPlaying=false
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8174833 frameTimestampUs=8174833 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8174833 frameTimestampUs=8174833 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.958Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.958Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.958Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8216542 seekToken=null acceptedFrameCount=200
[2026-04-24T02:51:25.958Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8216542 decodedFrameCount=199 isPlaying=false
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8216542 frameTimestampUs=8216542 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8216542 frameTimestampUs=8216542 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.958Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.958Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.958Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8258250 seekToken=null acceptedFrameCount=201
[2026-04-24T02:51:25.958Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8258250 decodedFrameCount=200 isPlaying=false
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8258250 frameTimestampUs=8258250 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8258250 frameTimestampUs=8258250 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.958Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.958Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.958Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8299958 seekToken=null acceptedFrameCount=202
[2026-04-24T02:51:25.958Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8299958 decodedFrameCount=201 isPlaying=false
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8299958 frameTimestampUs=8299958 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8299958 frameTimestampUs=8299958 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.958Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.958Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.958Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8341667 seekToken=null acceptedFrameCount=203
[2026-04-24T02:51:25.958Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8341667 decodedFrameCount=202 isPlaying=false
[2026-04-24T02:51:25.958Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8341667 frameTimestampUs=8341667 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.958Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8341667 frameTimestampUs=8341667 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8383375 seekToken=null acceptedFrameCount=204
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8383375 decodedFrameCount=203 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8383375 frameTimestampUs=8383375 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8383375 frameTimestampUs=8383375 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8425083 seekToken=null acceptedFrameCount=205
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8425083 decodedFrameCount=204 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8425083 frameTimestampUs=8425083 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8425083 frameTimestampUs=8425083 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8466792 seekToken=null acceptedFrameCount=206
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8466792 decodedFrameCount=205 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8466792 frameTimestampUs=8466792 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8466792 frameTimestampUs=8466792 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8508500 seekToken=null acceptedFrameCount=207
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8508500 decodedFrameCount=206 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8508500 frameTimestampUs=8508500 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8508500 frameTimestampUs=8508500 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8550208 seekToken=null acceptedFrameCount=208
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8550208 decodedFrameCount=207 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8550208 frameTimestampUs=8550208 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8550208 frameTimestampUs=8550208 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8591917 seekToken=null acceptedFrameCount=209
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8591917 decodedFrameCount=208 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8591917 frameTimestampUs=8591917 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8591917 frameTimestampUs=8591917 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8633625 seekToken=null acceptedFrameCount=210
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8633625 decodedFrameCount=209 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8633625 frameTimestampUs=8633625 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8633625 frameTimestampUs=8633625 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.959Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.959Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.959Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.959Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8675333 seekToken=null acceptedFrameCount=211
[2026-04-24T02:51:25.959Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8675333 decodedFrameCount=210 isPlaying=false
[2026-04-24T02:51:25.959Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8675333 frameTimestampUs=8675333 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.960Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8675333 frameTimestampUs=8675333 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.960Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.960Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.960Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:25.960Z] [DEBUG] Received worker message | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 type=FRAME destroyed=false
[2026-04-24T02:51:25.960Z] [DEBUG] Accepted decoded frame | component=DecoderPool clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8717042 seekToken=null acceptedFrameCount=212
[2026-04-24T02:51:25.960Z] [DEBUG] Relaying decoded frame to preview surface | component=PreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8717042 decodedFrameCount=211 isPlaying=false
[2026-04-24T02:51:25.960Z] [DEBUG] Forwarding decoded frame to preview canvas | component=usePreviewEngine clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8717042 frameTimestampUs=8717042 frameDisplayWidth=1280 frameDisplayHeight=720 hasPreviewHandle=true
[2026-04-24T02:51:25.960Z] [DEBUG] Posting decoded frame to compositor worker | component=PreviewCanvas clipId=460a4827-bb0d-4620-bd21-7c7cba820b37 timestampUs=8717042 frameTimestampUs=8717042 frameDisplayWidth=1280 frameDisplayHeight=720
[2026-04-24T02:51:25.960Z] [DEBUG] Forwarding compositor tick to preview canvas | component=usePreviewEngine playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 hasCaptionFrame=unchanged previewQualityLevel=full previewQualityScale=1 hasPreviewHandle=true
[2026-04-24T02:51:25.960Z] [DEBUG] Posting compositor tick | component=PreviewCanvas playheadMs=1077.3333333333337 clipCount=1 clipIds= textObjectCount=0 captionFrameState=unchanged previewQualityLevel=full previewQualityScale=1
[2026-04-24T02:51:25.960Z] [DEBUG] Ticked compositor | component=PreviewEngine playheadMs=1077.3333333333337 clipCount=1 textObjectCount=0 hasCaptionFrame=false previewQuality=full
[2026-04-24T02:51:28.691Z] [DEBUG] Priming audio context | component=PreviewEngine