/**
 * ClipDecodeWorker - runs in a Worker thread.
 *
 * Owns one VideoDecoder for one clip. It loads an MP4 asset with mp4box.js,
 * builds the seek/index metadata, and transfers decoded VideoFrame objects back
 * to the main thread.
 *
 * Message protocol (main -> worker):
 *   { type: "LOAD", assetUrl: string, clipId: string, metadata?: CachedDemuxMetadata }
 *   { type: "SEEK", targetMs: number, seekToken?: number | null }
 *   { type: "PLAY" }
 *   { type: "PAUSE" }
 *   { type: "DESTROY" }
 *
 * Message protocol (worker -> main):
 *   { type: "READY", clipId: string }
 *   { type: "METADATA_READY", clipId: string, assetUrl: string, metadata: CachedDemuxMetadata }
 *   { type: "FRAME", frame: VideoFrame, timestampUs: number, clipId: string, seekToken?: number | null }
 *   { type: "SEEK_DONE", clipId: string, seekToken?: number | null }
 *   { type: "SEEK_FAILED", message: string, clipId?: string, seekToken?: number | null }
 *   { type: "ERROR", message: string, clipId?: string }
 *
 * High-level flow:
 *   1. LOAD fetches/demuxes MP4 samples, or applies cached demux metadata.
 *   2. The worker creates one WebCodecs VideoDecoder for the clip.
 *   3. SEEK resets the decoder, feeds from the nearest keyframe, and transfers
 *      the first frame at or after the target time.
 *   4. PLAY runs a small pump that feeds encoded samples into VideoDecoder.
 *   5. VideoDecoder output transfers VideoFrames back to DecoderPool/main thread.
 *
 * Unit convention: mp4box sample timestamps are in track ticks. WebCodecs and
 * the compositor expect microseconds, so all decode timestamps/durations are
 * converted before creating EncodedVideoChunk objects.
 */

import { createFile, DataStream } from "mp4box";
import type { Movie, Sample, Track, VisualSampleEntry } from "mp4box";
import {
  MAX_DECODE_FETCH_BYTES,
  MAX_SEEK_DECODE_SAMPLES,
  assertSafeVideoTrack,
  assertSampleBudget,
} from "./decode-guard";

// mp4box v2.3 exposes a single Track type for both audio and video.
// Audio tracks have `track.audio` populated; video tracks have `track.video`.

interface KeyframeEntry {
  /** Decode timestamp in microseconds. */
  dts: number;
  /** Byte offset in the file. */
  offset: number;
  /** Sample index in the video-only sample list. */
  sampleIndex: number;
}

interface ClipMeta {
  assetUrl: string;
  clipId: string;
}

interface VideoTrackMetadata {
  id: number;
  timescale: number;
  codec: string;
  width: number;
  height: number;
}

interface DecodableVideoSample {
  dts: number;
  cts?: number;
  duration: number;
  is_sync: boolean;
  data?: Uint8Array;
}

interface DecoderConfigBox {
  write(stream: DataStream): void;
}

export interface CachedDemuxMetadata {
  assetUrl: string;
  videoTrack: VideoTrackMetadata;
  keyframeIndex: KeyframeEntry[];
  videoSamples: DecodableVideoSample[];
  decoderDescription?: Uint8Array;
}

type WorkerMessage =
  | {
      type: "LOAD";
      assetUrl: string;
      clipId: string;
      metadata?: CachedDemuxMetadata;
    }
  | { type: "SEEK"; targetMs: number; seekToken?: number | null }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "DESTROY" };

// Bun's lib does not include DedicatedWorkerGlobalScope. Define the minimal
// surface we need so postMessage uses the browser Transferable signature.
interface WorkerCtx extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}

const ctx = self as unknown as WorkerCtx;

class ClipDecodeWorker {
  /** Current clip identity; null means output frames should be closed. */
  private clipMeta: ClipMeta | null = null;
  private videoDecoder: VideoDecoder | null = null;
  /** Baseline config reused after VideoDecoder.reset(). */
  private videoDecoderConfig: VideoDecoderConfig | null = null;
  /** Keyframes in microseconds, used to choose a GOP start for seeking. */
  private keyframeIndex: KeyframeEntry[] = [];
  /** Demuxed video samples; sample.data is the encoded payload for WebCodecs. */
  private videoSamples: DecodableVideoSample[] = [];
  private videoTrackId = -1;
  private videoTimescale = 1;
  private cachedDecoderDescription: Uint8Array | undefined;
  private isPlaying = false;
  private playheadSampleIndex = 0;
  private loadAbortController: AbortController | null = null;
  private isDestroyed = false;
  private feedTimer: ReturnType<typeof setTimeout> | null = null;
  /** During seek, discard decoder output before this presentation timestamp. */
  private seekOutputThresholdUs: number | null = null;
  private didEmitFrameForActiveSeek = false;
  private activeSeekToken: number | null = null;
  private bufferedFramesAfterSeek: VideoFrame[] = [];
  /** Guards async LOAD work so stale fetch/demux results cannot publish READY. */
  private loadGeneration = 0;

  /**
   * True after configure/reset; cleared on the first key-chunk decode.
   * Some browsers clear decoder reference frames after flush(), so playback may
   * need to rewind to a GOP start before feeding the next delta frame.
   */
  private decoderNeedsKeyFrame = true;

  constructor(private readonly worker: WorkerCtx) {
    this.worker.onmessage = (event: MessageEvent) => {
      void this.handleMessage(event.data as WorkerMessage);
    };
  }

  // ---------------------------------------------------------------------------
  // Message lifecycle
  // ---------------------------------------------------------------------------

  private async handleMessage(message: WorkerMessage): Promise<void> {
    switch (message.type) {
      case "LOAD":
        await this.load(message);
        break;
      case "SEEK":
        await this.seek(message);
        break;
      case "PLAY":
        this.play();
        break;
      case "PAUSE":
        this.pause();
        break;
      case "DESTROY":
        this.destroy();
        break;
    }
  }

  /**
   * Entry point for a clip. This is intentionally first in the class because it
   * resets old state, demuxes or applies metadata, creates the decoder, and posts
   * READY. Everything else hangs off this setup.
   */
  private async load(message: Extract<WorkerMessage, { type: "LOAD" }>) {
    const generation = this.startNewLoad(message.assetUrl, message.clipId);

    try {
      let videoTrack: VideoTrackMetadata;

      if (message.metadata) {
        // Fast path used when DecoderPool already cached demux results for asset.
        videoTrack = this.applyCachedMetadata(message.metadata);
      } else {
        const loadedTrack = await this.loadAsset(message.assetUrl);
        if (!this.isActiveGeneration(generation)) return;

        const metadata = this.buildCachedMetadata(
          message.assetUrl,
          loadedTrack
        );
        this.postMetadataReady(message.assetUrl, message.clipId, metadata);
        videoTrack = metadata.videoTrack;
      }

      if (!this.isActiveGeneration(generation)) return;

      this.videoDecoder = this.createVideoDecoder(videoTrack);
      this.worker.postMessage({ type: "READY", clipId: message.clipId });
    } catch (error) {
      if (!this.shouldReportError(error, generation)) return;
      this.postError(error, message.clipId);
    }
  }

  private async seek(message: Extract<WorkerMessage, { type: "SEEK" }>) {
    this.isPlaying = false;
    this.stopFeedLoop();

    const seekToken =
      "seekToken" in message ? (message.seekToken ?? null) : null;

    try {
      await this.seekTo(message.targetMs, seekToken);
      if (!this.clipMeta?.clipId) return;
      this.worker.postMessage({
        type: "SEEK_DONE",
        clipId: this.clipMeta.clipId,
        seekToken,
      });
    } catch (error) {
      if (this.isDestroyed || isAbortError(error)) return;
      this.worker.postMessage({
        type: "SEEK_FAILED",
        message: formatError(error),
        clipId: this.clipMeta?.clipId,
        seekToken,
      });
    }
  }

  private play(): void {
    this.isPlaying = true;
    this.ensureFeedLoop();
  }

  private pause(): void {
    this.isPlaying = false;
    this.stopFeedLoop();
    // Do not flush: pause/resume should keep the decoder's current position.
  }

  private destroy(): void {
    this.loadGeneration++;
    this.isDestroyed = true;
    this.isPlaying = false;
    this.stopFeedLoop();
    this.abortLoad();
    this.clearBufferedFrames();
    this.resetSeekState();
    this.closeVideoDecoder();
    this.videoSamples = [];
    this.keyframeIndex = [];
    this.cachedDecoderDescription = undefined;
    this.worker.close();
  }

  private startNewLoad(assetUrl: string, clipId: string): number {
    const generation = ++this.loadGeneration;

    this.abortLoad();
    this.isDestroyed = false;
    this.isPlaying = false;
    this.stopFeedLoop();
    this.clearBufferedFrames();
    this.closeVideoDecoder();
    this.clipMeta = { assetUrl, clipId };
    this.resetSeekState();
    this.keyframeIndex = [];
    this.videoSamples = [];
    this.videoTrackId = -1;
    this.videoTimescale = 1;
    this.cachedDecoderDescription = undefined;
    this.playheadSampleIndex = 0;
    this.decoderNeedsKeyFrame = true;

    return generation;
  }

  // ---------------------------------------------------------------------------
  // Asset loading and metadata
  // ---------------------------------------------------------------------------

  /**
   * Fetches the MP4, feeds it into mp4box, and fills this instance's samples and
   * keyframe index.
   *
   * Order: fetch -> appendBuffer/flush -> onReady finds the video track ->
   * setExtractionOptions/start -> onSamples stores video samples.
   *
   * This worker only decodes video. Muxed audio is still handled by the preview
   * engine's audio path.
   */
  private async loadAsset(url: string): Promise<Track> {
    return new Promise((resolve, reject) => {
      const mp4boxFile = createFile();
      const abortController = new AbortController();
      let foundVideoTrack: Track | null = null;
      let fileOffset = 0;
      let settled = false;

      this.loadAbortController = abortController;

      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const resolveOnce = (videoTrack: Track) => {
        if (settled) return;
        settled = true;
        resolve(videoTrack);
      };

      mp4boxFile.onError = rejectOnce;
      mp4boxFile.onReady = (info: Movie) => {
        foundVideoTrack = info.videoTracks[0] ?? null;

        if (!foundVideoTrack) {
          rejectOnce(new Error("No video track found in asset"));
          return;
        }

        assertSafeVideoTrack(foundVideoTrack);

        this.videoTrackId = foundVideoTrack.id;
        this.videoTimescale = foundVideoTrack.timescale ?? 1;
        mp4boxFile.setExtractionOptions(this.videoTrackId, null, {
          nbSamples: Infinity,
        });
        mp4boxFile.start();
      };

      mp4boxFile.onSamples = (
        trackId: number,
        _user: unknown,
        samples: Sample[]
      ) => {
        if (trackId !== this.videoTrackId) return;

        try {
          assertSampleBudget(this.videoSamples.length, samples);
        } catch (error) {
          rejectOnce(error);
          return;
        }

        const baseIndex = this.videoSamples.length;
        this.videoSamples.push(...samples);
        // Build once during demux so seeks can jump straight to the GOP start.
        this.addKeyframes(samples, baseIndex);
      };

      this.fetchAssetBuffer(url, abortController)
        .then((buffer) => {
          const mp4Buffer = buffer as ArrayBuffer & { fileStart: number };
          mp4Buffer.fileStart = fileOffset;
          fileOffset += buffer.byteLength;

          mp4boxFile.appendBuffer(mp4Buffer);
          mp4boxFile.flush();
          this.clearLoadController(abortController);

          if (foundVideoTrack) {
            resolveOnce(foundVideoTrack);
          } else {
            rejectOnce(new Error("mp4box did not produce track info"));
          }
        })
        .catch((error) => {
          this.clearLoadController(abortController);
          if (isAbortError(error) && this.isDestroyed) return;
          rejectOnce(error);
        });
    });
  }

  private async fetchAssetBuffer(
    url: string,
    abortController: AbortController
  ): Promise<ArrayBuffer> {
    const response = await fetch(url, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Asset fetch failed: ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_DECODE_FETCH_BYTES) {
      throw new Error(formatFetchLimitError());
    }

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_DECODE_FETCH_BYTES) {
        throw new Error(formatFetchLimitError());
      }
      return buffer;
    }

    return this.readLimitedStream(response.body, abortController);
  }

  private async readLimitedStream(
    body: ReadableStream<Uint8Array>,
    abortController: AbortController
  ): Promise<ArrayBuffer> {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_DECODE_FETCH_BYTES) {
        abortController.abort();
        throw new Error(formatFetchLimitError());
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined.buffer;
  }

  private addKeyframes(samples: Sample[], baseIndex: number): void {
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      if (!sample.is_sync) continue;

      this.keyframeIndex.push({
        dts: this.ticksToUs(sample.dts),
        offset: sample.offset,
        sampleIndex: baseIndex + index,
      });
    }
  }

  private applyCachedMetadata(
    metadata: CachedDemuxMetadata
  ): VideoTrackMetadata {
    this.videoTrackId = metadata.videoTrack.id;
    this.videoTimescale = metadata.videoTrack.timescale;
    this.keyframeIndex = metadata.keyframeIndex.map((entry) => ({ ...entry }));
    this.videoSamples = metadata.videoSamples.map((sample) => ({ ...sample }));
    this.cachedDecoderDescription = metadata.decoderDescription;
    return metadata.videoTrack;
  }

  private buildCachedMetadata(
    assetUrl: string,
    videoTrack: Track
  ): CachedDemuxMetadata {
    return {
      assetUrl,
      videoTrack: {
        id: videoTrack.id,
        timescale: videoTrack.timescale ?? 1,
        codec: videoTrack.codec,
        width: videoTrack.video?.width ?? 0,
        height: videoTrack.video?.height ?? 0,
      },
      keyframeIndex: this.keyframeIndex.map((entry) => ({ ...entry })),
      videoSamples: this.videoSamples.map((sample) => ({
        dts: sample.dts,
        cts: sample.cts,
        duration: sample.duration,
        is_sync: sample.is_sync,
        data: sample.data,
      })),
      decoderDescription: this.getVideoDescription(),
    };
  }

  private postMetadataReady(
    assetUrl: string,
    clipId: string,
    metadata: CachedDemuxMetadata
  ): void {
    this.worker.postMessage({
      type: "METADATA_READY",
      clipId,
      assetUrl,
      metadata,
    });
  }

  // ---------------------------------------------------------------------------
  // Decoder setup and frame output
  // ---------------------------------------------------------------------------

  private createVideoDecoder(videoTrack: VideoTrackMetadata): VideoDecoder {
    const config: VideoDecoderConfig = {
      codec: videoTrack.codec,
      codedWidth: videoTrack.width,
      codedHeight: videoTrack.height,
      hardwareAcceleration: "prefer-hardware",
    };
    this.videoDecoderConfig = config;

    const decoder = new VideoDecoder({
      output: (frame) => this.handleDecodedFrame(frame),
      error: (error) => this.postError(error, this.clipMeta?.clipId),
    });

    decoder.configure(this.withDecoderDescription(config));
    this.decoderNeedsKeyFrame = true;
    return decoder;
  }

  private handleDecodedFrame(frame: VideoFrame): void {
    if (!this.clipMeta) {
      frame.close();
      return;
    }

    if (this.seekOutputThresholdUs === null) {
      this.postFrame(frame);
      return;
    }

    if (frame.timestamp < this.seekOutputThresholdUs) {
      frame.close();
      return;
    }

    if (!this.didEmitFrameForActiveSeek) {
      this.didEmitFrameForActiveSeek = true;
      this.postFrame(frame, this.activeSeekToken);
      return;
    }

    // Keep future frames decoded during seek so resumed playback can use them.
    this.bufferedFramesAfterSeek.push(frame);
  }

  private postFrame(frame: VideoFrame, seekToken?: number | null): void {
    if (!this.clipMeta) {
      frame.close();
      return;
    }

    this.worker.postMessage(
      {
        type: "FRAME",
        frame,
        timestampUs: frame.timestamp,
        clipId: this.clipMeta.clipId,
        ...(seekToken !== undefined ? { seekToken } : {}),
      },
      [frame as unknown as Transferable]
    );
  }

  private reconfigureVideoDecoder(decoder: VideoDecoder): void {
    if (!this.videoDecoderConfig) return;
    decoder.configure(this.withDecoderDescription(this.videoDecoderConfig));
    this.decoderNeedsKeyFrame = true;
  }

  private withDecoderDescription(
    config: VideoDecoderConfig
  ): VideoDecoderConfig {
    const description = this.getVideoDescription();
    return description ? { ...config, description } : config;
  }

  /**
   * Extracts codec init bytes (avcC/hvcC) from the first sample's description
   * box. WebCodecs needs these bytes for H.264/H.265 streams inside MP4.
   */
  private getVideoDescription(): Uint8Array | undefined {
    if (this.cachedDecoderDescription) return this.cachedDecoderDescription;

    const sample = this.videoSamples[0] as Sample | undefined;
    if (!sample?.description) return undefined;

    const entry = sample.description as VisualSampleEntry;
    const configBox = entry.avcC ?? entry.hvcC;
    if (!configBox) return undefined;

    try {
      const stream = new DataStream();
      (configBox as DecoderConfigBox).write(stream);

      const bytes = new Uint8Array(stream.buffer, 0, stream.byteLength);
      const recordOffset = this.getConfigRecordOffset(bytes);
      if (recordOffset >= bytes.byteLength) return undefined;

      this.cachedDecoderDescription = bytes.slice(recordOffset);
      return this.cachedDecoderDescription;
    } catch {
      return undefined;
    }
  }

  private getConfigRecordOffset(bytes: Uint8Array): number {
    if (bytes.byteLength < 8) return 0;

    const boxSize =
      bytes[0]! * 0x1000000 + (bytes[1]! << 16) + (bytes[2]! << 8) + bytes[3]!;
    const boxType = String.fromCharCode(
      bytes[4]!,
      bytes[5]!,
      bytes[6]!,
      bytes[7]!
    );
    return boxSize === bytes.byteLength &&
      (boxType === "avcC" || boxType === "hvcC")
      ? 8
      : 0;
  }

  // ---------------------------------------------------------------------------
  // Seeking
  // ---------------------------------------------------------------------------

  /**
   * Seeks in source time. It picks the last keyframe at or before the target,
   * resets the decoder, decodes from that GOP through the target frame, then
   * lets the output callback transfer the first eligible frame.
   */
  private async seekTo(
    targetMs: number,
    seekToken: number | null
  ): Promise<void> {
    if (!this.videoDecoder || !this.clipMeta) return;
    if (this.videoSamples.length === 0) {
      throw new Error("No decodable video samples available for seek");
    }

    const targetUs = targetMs * 1000;
    const gopEntry = this.findSeekKeyframe(targetUs);

    // Decoder reference state is no longer valid after reset, so the seek feed
    // must start on a keyframe and run forward until the target frame appears.
    this.clearBufferedFrames();
    this.videoDecoder.reset();
    this.reconfigureVideoDecoder(this.videoDecoder);
    this.seekOutputThresholdUs = targetUs;
    this.didEmitFrameForActiveSeek = false;
    this.activeSeekToken = seekToken;
    this.playheadSampleIndex = this.videoSamples.length;

    let decodedSamples = 0;
    let crossedTarget = false;

    try {
      for (
        let index = gopEntry.sampleIndex;
        index < this.videoSamples.length;
        index++
      ) {
        const sample = this.videoSamples[index];
        if (!sample.data) continue;

        decodedSamples++;
        if (decodedSamples > MAX_SEEK_DECODE_SAMPLES) {
          throw new Error(
            `Seek decode budget exceeded (${MAX_SEEK_DECODE_SAMPLES} samples)`
          );
        }

        this.decodeSample(sample);

        if (this.getSampleTimestampUs(sample) >= targetUs) {
          crossedTarget = true;
        }

        if (!crossedTarget) continue;

        await this.videoDecoder.flush();
        this.decoderNeedsKeyFrame = true;
        if (this.didEmitFrameForActiveSeek) {
          this.playheadSampleIndex = index + 1;
          return;
        }
      }

      if (crossedTarget) {
        throw new Error(
          `Failed to decode a frame for seek target ${targetMs}ms`
        );
      }
    } finally {
      this.resetSeekState();
    }
  }

  private findSeekKeyframe(targetUs: number): KeyframeEntry {
    let gopEntry = this.keyframeIndex[0];
    if (!gopEntry) {
      throw new Error("No keyframes available for seek");
    }

    for (const entry of this.keyframeIndex) {
      if (entry.dts <= targetUs) {
        gopEntry = entry;
      } else {
        break;
      }
    }

    return gopEntry;
  }

  // ---------------------------------------------------------------------------
  // Continuous decode loop
  // ---------------------------------------------------------------------------

  private ensureFeedLoop(): void {
    if (this.feedTimer !== null) return;
    this.drainBufferedFrames();
    this.feedTimer = setTimeout(this.feedNextChunk, 0);
  }

  private readonly feedNextChunk = (): void => {
    this.feedTimer = null;
    if (!this.isPlaying || !this.videoDecoder) return;

    if (this.videoDecoder.decodeQueueSize > 8) {
      // Back-pressure: let VideoDecoder drain before adding more chunks.
      this.feedTimer = setTimeout(this.feedNextChunk, 16);
      return;
    }

    if (this.playheadSampleIndex >= this.videoSamples.length) {
      this.isPlaying = false;
      return;
    }

    this.rewindToKeyframeIfNeeded();

    const sample = this.videoSamples[this.playheadSampleIndex++];
    if (sample?.data) {
      this.decodeSample(sample);
    }

    this.feedTimer = setTimeout(this.feedNextChunk, 0);
  };

  private rewindToKeyframeIfNeeded(): void {
    const nextSample = this.videoSamples[this.playheadSampleIndex];
    if (!this.decoderNeedsKeyFrame || nextSample?.is_sync) return;

    let gopStart = 0;
    for (const entry of this.keyframeIndex) {
      if (entry.sampleIndex <= this.playheadSampleIndex) {
        gopStart = entry.sampleIndex;
      } else {
        break;
      }
    }

    this.playheadSampleIndex = gopStart;
  }

  private decodeSample(sample: DecodableVideoSample): void {
    if (!this.videoDecoder || !sample.data) return;

    const isKey = sample.is_sync;
    const chunk = new EncodedVideoChunk({
      type: isKey ? "key" : "delta",
      timestamp: this.getSampleTimestampUs(sample),
      duration: this.getSampleDurationUs(sample),
      data: sample.data,
    });

    this.videoDecoder.decode(chunk);
    if (isKey) {
      this.decoderNeedsKeyFrame = false;
    }
  }

  private stopFeedLoop(): void {
    if (this.feedTimer === null) return;
    clearTimeout(this.feedTimer);
    this.feedTimer = null;
  }

  // ---------------------------------------------------------------------------
  // Cleanup and small helpers
  // ---------------------------------------------------------------------------

  private drainBufferedFrames(): void {
    if (this.bufferedFramesAfterSeek.length === 0) return;

    const frames = this.bufferedFramesAfterSeek;
    this.bufferedFramesAfterSeek = [];
    for (const frame of frames) {
      this.postFrame(frame);
    }
  }

  private clearBufferedFrames(): void {
    for (const frame of this.bufferedFramesAfterSeek) {
      frame.close();
    }
    this.bufferedFramesAfterSeek = [];
  }

  private closeVideoDecoder(): void {
    if (!this.videoDecoder) return;

    try {
      this.videoDecoder.close();
    } catch {
      // Ignore close failures during teardown/reload.
    }

    this.videoDecoder = null;
  }

  private abortLoad(): void {
    this.loadAbortController?.abort();
    this.loadAbortController = null;
  }

  private clearLoadController(abortController: AbortController): void {
    if (this.loadAbortController === abortController) {
      this.loadAbortController = null;
    }
  }

  private resetSeekState(): void {
    this.seekOutputThresholdUs = null;
    this.didEmitFrameForActiveSeek = false;
    this.activeSeekToken = null;
  }

  private isActiveGeneration(generation: number): boolean {
    return !this.isDestroyed && generation === this.loadGeneration;
  }

  private shouldReportError(error: unknown, generation: number): boolean {
    return this.isActiveGeneration(generation) && !isAbortError(error);
  }

  private postError(error: unknown, clipId?: string): void {
    this.worker.postMessage({
      type: "ERROR",
      message: formatError(error),
      clipId,
    });
  }

  private getSampleTimestampUs(sample: DecodableVideoSample): number {
    const ticks = sample.cts ?? sample.dts;
    return this.ticksToUs(ticks);
  }

  private getSampleDurationUs(sample: DecodableVideoSample): number {
    return this.ticksToUs(sample.duration);
  }

  private ticksToUs(ticks: number): number {
    return Math.round((ticks * 1_000_000) / this.videoTimescale);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatFetchLimitError(): string {
  const limitMb = Math.floor(MAX_DECODE_FETCH_BYTES / (1024 * 1024));
  return `Asset exceeds decode size limit (${limitMb}MB)`;
}

new ClipDecodeWorker(ctx);
