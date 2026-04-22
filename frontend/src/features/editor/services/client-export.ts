/* global VideoEncoderConfig, OfflineAudioContext, AudioBuffer, VideoFrame */

import { createFile, type ISOFile } from "mp4box";
import {
  buildAudioClipDescriptors,
  type AudioClipDescriptor,
} from "../engine/AudioMixer";
import {
  buildCompositorDescriptorsWithRust,
  buildExportFrameRequestsWithRust,
  preloadEditorCoreWasm,
  type ExportFrameRequest,
} from "../engine/editor-core-wasm";
import type { TextClip, Track } from "../types/editor";
import type {
  CompositorClipDescriptor,
  CompositorClipPath,
  CompositorClipTransform,
  SerializedTextObject,
} from "../engine/CompositorWorker";
import {
  drawTextObject,
  getObjectContainRect,
} from "../engine/compositor/types";
import { isTextClip } from "../utils/clip-types";
import { getTextClipPreviewDisplay } from "../utils/text-segments";

const MAX_CLIENT_EXPORT_DURATION_MS = 5 * 60 * 1000;
const MAX_CLIENT_EXPORT_PIXELS = 1920 * 1080;
const VIDEO_TIMESCALE = 1_000_000;

export interface ClientExportOptions {
  tracks: Track[];
  assetUrlMap: Map<string, string>;
  durationMs: number;
  resolution: string;
  fps: 24 | 30 | 60;
}

export interface ClientExportCapability {
  supported: boolean;
  reasons: string[];
  videoEncoderConfig?: VideoEncoderConfig;
}

export type ClientExportResult =
  | {
      status: "done";
      blob: Blob;
      objectUrl: string;
      filename: string;
    }
  | {
      status: "fallback";
      reason: string;
    };

type BrowserMediaGlobals = typeof globalThis & {
  VideoEncoder?: typeof VideoEncoder;
  VideoFrame?: typeof VideoFrame;
  OfflineAudioContext?: typeof OfflineAudioContext;
};

interface EncodedVideoSample {
  data: Uint8Array<ArrayBuffer>;
  durationUs: number;
  timestampUs: number;
  type: EncodedVideoChunkType;
}

interface VideoExportRenderSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export async function evaluateClientExportCapability(
  options: ClientExportOptions
): Promise<ClientExportCapability> {
  const reasons: string[] = [];
  const globals = globalThis as BrowserMediaGlobals;
  const { width, height } = parseResolution(options.resolution);

  if (!globals.VideoEncoder) {
    reasons.push("VideoEncoder is not available in this browser.");
  }

  if (!globals.VideoFrame) {
    reasons.push("VideoFrame is not available in this browser.");
  }

  if (!globals.OfflineAudioContext) {
    reasons.push("OfflineAudioContext is not available in this browser.");
  }

  if (options.durationMs <= 0) {
    reasons.push("The timeline is empty.");
  }

  if (options.durationMs > MAX_CLIENT_EXPORT_DURATION_MS) {
    reasons.push("Timeline is longer than the 5 minute client export limit.");
  }

  if (width * height > MAX_CLIENT_EXPORT_PIXELS) {
    reasons.push(
      "Resolution is above the current client export memory budget."
    );
  }

  const missingAssetUrls = collectRenderableAssetIds(options.tracks).filter(
    (assetId) => !options.assetUrlMap.has(assetId)
  );
  if (missingAssetUrls.length > 0) {
    reasons.push(
      "One or more timeline assets are not available in the browser."
    );
  }

  const videoEncoderConfig: VideoEncoderConfig = {
    codec: "avc1.42E01E",
    width,
    height,
    framerate: options.fps,
    bitrate: estimateVideoBitrate(width, height, options.fps),
    hardwareAcceleration: "prefer-hardware",
  };

  if (globals.VideoEncoder?.isConfigSupported) {
    try {
      const support =
        await globals.VideoEncoder.isConfigSupported(videoEncoderConfig);
      if (!support.supported) {
        reasons.push(
          "The browser cannot encode the requested MP4 video codec."
        );
      }
    } catch {
      reasons.push("The browser could not validate the requested video codec.");
    }
  }

  if (!(await hasClientMp4Muxer())) {
    reasons.push("Client MP4 muxer is not available.");
  }

  return {
    supported: reasons.length === 0,
    reasons,
    videoEncoderConfig,
  };
}

export async function runClientExport(
  options: ClientExportOptions
): Promise<ClientExportResult> {
  const capability = await evaluateClientExportCapability(options);
  if (!capability.supported) {
    return {
      status: "fallback",
      reason: capability.reasons[0] ?? "Client export is unavailable.",
    };
  }

  await preloadEditorCoreWasm();
  const frameRequests = buildExportFrameRequestsWithRust(
    options.tracks,
    options.durationMs,
    options.fps
  );
  if (frameRequests.length === 0) {
    return {
      status: "fallback",
      reason: "No video frames were available for client export.",
    };
  }

  try {
    const audioClips = buildAudioClipDescriptors(
      options.tracks,
      options.assetUrlMap
    );
    if (audioClips.length > 0) {
      await renderOfflineAudioMix(audioClips, options.durationMs);
      return {
        status: "fallback",
        reason:
          "Client export rendered the audio mix, but browser-side MP4 audio muxing is not enabled yet.",
      };
    }

    const { width, height } = parseResolution(options.resolution);
    const samples = await encodeVideoFrames(options, frameRequests, {
      width,
      height,
      config: capability.videoEncoderConfig!,
    });
    const blob = muxVideoMp4(samples, {
      width,
      height,
      durationMs: options.durationMs,
      fps: options.fps,
    });
    const filename = getClientExportFilename(options.resolution, options.fps);
    return {
      status: "done",
      blob,
      objectUrl: URL.createObjectURL(blob),
      filename,
    };
  } catch (error) {
    return {
      status: "fallback",
      reason:
        error instanceof Error
          ? error.message
          : "Client export encode/mux failed.",
    };
  }
}

export function getClientExportFilename(
  resolution: string,
  fps: number
): string {
  return `reelstudio-export-${resolution}-${fps}fps.mp4`;
}

export function getExportFrameRequestsForTimeline(
  tracks: Track[],
  durationMs: number,
  fps: number
): ExportFrameRequest[] {
  return buildExportFrameRequestsWithRust(tracks, durationMs, fps);
}

async function hasClientMp4Muxer(): Promise<boolean> {
  try {
    return typeof createFile === "function";
  } catch {
    return false;
  }
}

async function encodeVideoFrames(
  options: ClientExportOptions,
  frameRequests: ExportFrameRequest[],
  encodeOptions: { width: number; height: number; config: VideoEncoderConfig }
): Promise<EncodedVideoSample[]> {
  const globals = globalThis as BrowserMediaGlobals;
  if (!globals.VideoEncoder || !globals.VideoFrame) {
    throw new Error("WebCodecs video export is unavailable.");
  }

  const surface = createVideoExportSurface(
    encodeOptions.width,
    encodeOptions.height
  );
  const videos = await loadVideoElements(options.tracks, options.assetUrlMap);
  const samples: EncodedVideoSample[] = [];
  let decoderDescription: AllowSharedBufferSource | null = null;
  let encodeError: Error | null = null;

  const frameDurationUs = Math.round(1_000_000 / options.fps);
  const encoder = new globals.VideoEncoder({
    output(chunk, metadata) {
      if (metadata?.decoderConfig?.description) {
        decoderDescription = metadata.decoderConfig.description;
      }
      const data = new Uint8Array(chunk.byteLength) as Uint8Array<ArrayBuffer>;
      chunk.copyTo(data);
      samples.push({
        data,
        durationUs: chunk.duration ?? frameDurationUs,
        timestampUs: chunk.timestamp,
        type: chunk.type,
      });
    },
    error(error) {
      encodeError = error;
    },
  });

  encoder.configure(encodeOptions.config);

  for (const frameRequest of frameRequests) {
    await renderExportFrame(surface, options, frameRequest, videos);
    const frame = new globals.VideoFrame(surface.canvas, {
      timestamp: Math.round(frameRequest.timelineMs * 1000),
      duration: frameDurationUs,
    });
    encoder.encode(frame, {
      keyFrame: frameRequest.frameIndex % options.fps === 0,
    });
    frame.close();

    if (encodeError) throw encodeError;
  }

  await encoder.flush();
  encoder.close();

  if (encodeError) throw encodeError;
  if (samples.length === 0) {
    throw new Error("Client export produced no encoded video samples.");
  }
  if (!decoderDescription) {
    throw new Error("VideoEncoder did not provide an MP4 decoder config.");
  }
  const videoDecoderDescription = decoderDescription;

  return samples.map((sample, index) =>
    index === 0
      ? {
          ...sample,
          data: attachDecoderDescription(sample.data, videoDecoderDescription),
        }
      : sample
  );
}

function muxVideoMp4(
  samplesWithDescription: EncodedVideoSample[],
  options: { width: number; height: number; durationMs: number; fps: number }
): Blob {
  const [firstSample, ...samples] = samplesWithDescription;
  if (!firstSample) {
    throw new Error("No encoded video samples were available for muxing.");
  }

  const { sample, description } = detachDecoderDescription(firstSample.data);
  const file = createFile() as ISOFile;
  const durationUs = Math.round(options.durationMs * 1000);
  const trackId = file.addTrack({
    type: "avc1",
    width: options.width,
    height: options.height,
    timescale: VIDEO_TIMESCALE,
    duration: durationUs,
    media_duration: durationUs,
    default_sample_duration: Math.round(VIDEO_TIMESCALE / options.fps),
    avcDecoderConfigRecord: description.buffer.slice(
      description.byteOffset,
      description.byteOffset + description.byteLength
    ),
  });

  addMp4VideoSample(file, trackId, { ...firstSample, data: sample });
  for (const encodedSample of samples) {
    addMp4VideoSample(file, trackId, encodedSample);
  }

  return file.save("client-export.mp4");
}

function addMp4VideoSample(
  file: ISOFile,
  trackId: number,
  sample: EncodedVideoSample
): void {
  file.addSample(trackId, sample.data, {
    duration: sample.durationUs,
    dts: sample.timestampUs,
    cts: 0,
    is_sync: sample.type === "key",
  });
}

function attachDecoderDescription(
  sample: Uint8Array<ArrayBuffer>,
  description: AllowSharedBufferSource
): Uint8Array<ArrayBuffer> {
  const descriptionBytes = ArrayBuffer.isView(description)
    ? new Uint8Array(
        description.buffer,
        description.byteOffset,
        description.byteLength
      )
    : new Uint8Array(description);
  const output = new Uint8Array(
    4 + descriptionBytes.byteLength + sample.byteLength
  );
  new DataView(output.buffer).setUint32(0, descriptionBytes.byteLength);
  output.set(descriptionBytes, 4);
  output.set(sample, 4 + descriptionBytes.byteLength);
  return output as Uint8Array<ArrayBuffer>;
}

function detachDecoderDescription(data: Uint8Array<ArrayBuffer>): {
  description: Uint8Array<ArrayBuffer>;
  sample: Uint8Array<ArrayBuffer>;
} {
  const descriptionLength = new DataView(data.buffer).getUint32(0);
  return {
    description: data.slice(
      4,
      4 + descriptionLength
    ) as Uint8Array<ArrayBuffer>,
    sample: data.slice(4 + descriptionLength) as Uint8Array<ArrayBuffer>,
  };
}

function createVideoExportSurface(
  width: number,
  height: number
): VideoExportRenderSurface {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Could not create a 2D export canvas.");
  }
  return { canvas, ctx, width, height };
}

async function loadVideoElements(
  tracks: Track[],
  assetUrlMap: Map<string, string>
): Promise<Map<string, HTMLVideoElement>> {
  const assetIds = collectVideoAssetIds(tracks);
  const entries = await Promise.all(
    assetIds.map(async (assetId) => {
      const assetUrl = assetUrlMap.get(assetId);
      if (!assetUrl) {
        throw new Error("One or more video assets are unavailable for export.");
      }
      return [assetId, await loadVideoElement(assetUrl)] as const;
    })
  );
  return new Map(entries);
}

function loadVideoElement(assetUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () =>
      reject(new Error("A video asset could not be loaded for export."));
    video.src = assetUrl;
    video.load();
  });
}

async function renderExportFrame(
  surface: VideoExportRenderSurface,
  options: ClientExportOptions,
  frameRequest: ExportFrameRequest,
  videos: Map<string, HTMLVideoElement>
): Promise<void> {
  const { ctx, width, height } = surface;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const descriptors = buildCompositorDescriptorsWithRust(
    options.tracks,
    frameRequest.timelineMs,
    null
  );
  const requestByClipId = new Map(
    frameRequest.requests.map((request) => [request.clipId, request])
  );

  for (const clip of descriptors
    .filter((descriptor) => descriptor.enabled && descriptor.opacity > 0)
    .sort((a, b) => a.zIndex - b.zIndex)) {
    const request = requestByClipId.get(clip.clipId);
    const assetId =
      typeof request?.assetId === "string" ? request.assetId : null;
    const video = assetId ? videos.get(assetId) : null;
    if (!video || !request) continue;
    await seekVideo(video, request.sourceTimeMs / 1000);
    drawExportVideoClip(surface, clip, video);
  }

  for (const text of buildExportTextObjects(
    options.tracks,
    frameRequest.timelineMs,
    width,
    height
  )) {
    drawTextObject(ctx as unknown as OffscreenCanvasRenderingContext2D, text);
  }
}

function seekVideo(
  video: HTMLVideoElement,
  timeSeconds: number
): Promise<void> {
  const targetTime = Math.max(
    0,
    Math.min(video.duration || timeSeconds, timeSeconds)
  );
  if (Math.abs(video.currentTime - targetTime) < 0.005) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("A video asset could not seek during client export."));
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = targetTime;
  });
}

function drawExportVideoClip(
  surface: VideoExportRenderSurface,
  clip: CompositorClipDescriptor,
  video: HTMLVideoElement
): void {
  const { ctx, width, height } = surface;
  const rect = getObjectContainRect(
    {
      displayWidth: video.videoWidth || width,
      displayHeight: video.videoHeight || height,
    } as VideoFrame,
    width,
    height
  );

  ctx.save();
  ctx.globalAlpha = clip.opacity;
  ctx.filter = buildCanvasFilter(clip.effects);
  if (clip.clipPath) applyClipPath(ctx, clip.clipPath, width, height);
  applyTransform(ctx, clip.transform, width, height);
  ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh);
  ctx.restore();
}

function applyTransform(
  ctx: CanvasRenderingContext2D,
  transform: CompositorClipTransform,
  width: number,
  height: number
): void {
  const scale =
    Number.isFinite(transform.scale) && transform.scale > 0
      ? transform.scale
      : 1;
  if (scale !== 1) {
    ctx.transform(
      scale,
      0,
      0,
      scale,
      (width / 2) * (1 - scale),
      (height / 2) * (1 - scale)
    );
  }

  const translateX =
    transform.translateX + (transform.translateXPercent / 100) * width;
  const translateY =
    transform.translateY + (transform.translateYPercent / 100) * height;
  if (translateX !== 0 || translateY !== 0)
    ctx.translate(translateX, translateY);

  if (transform.rotationDeg === 0) return;
  const radians = (transform.rotationDeg * Math.PI) / 180;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.translate(-width / 2, -height / 2);
}

function applyClipPath(
  ctx: CanvasRenderingContext2D,
  clipPath: CompositorClipPath,
  width: number,
  height: number
): void {
  if (clipPath.type === "inset") {
    const top = (clipPath.top / 100) * height;
    const right = (clipPath.right / 100) * width;
    const bottom = (clipPath.bottom / 100) * height;
    const left = (clipPath.left / 100) * width;
    ctx.beginPath();
    ctx.rect(left, top, width - left - right, height - top - bottom);
    ctx.clip();
    return;
  }

  if (clipPath.points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(
    (clipPath.points[0]!.x / 100) * width,
    (clipPath.points[0]!.y / 100) * height
  );
  for (let index = 1; index < clipPath.points.length; index += 1) {
    ctx.lineTo(
      (clipPath.points[index]!.x / 100) * width,
      (clipPath.points[index]!.y / 100) * height
    );
  }
  ctx.closePath();
  ctx.clip();
}

function buildCanvasFilter(effects: {
  contrast: number;
  warmth: number;
}): string {
  const filterParts: string[] = [];
  if (effects.contrast !== 0)
    filterParts.push(`contrast(${1 + effects.contrast / 100})`);
  if (effects.warmth !== 0) {
    filterParts.push(
      `hue-rotate(${-effects.warmth * 0.3}deg)`,
      `saturate(${1 + effects.warmth * 0.005})`
    );
  }
  return filterParts.join(" ") || "none";
}

function buildExportTextObjects(
  tracks: Track[],
  timelineMs: number,
  width: number,
  height: number
): SerializedTextObject[] {
  const textTrack = tracks.find((track) => track.type === "text");
  if (!textTrack) return [];

  return textTrack.clips
    .filter(isTextClip)
    .filter(
      (clip): clip is TextClip =>
        timelineMs >= clip.startMs &&
        timelineMs < clip.startMs + clip.durationMs
    )
    .map((clip) => {
      const elapsedMs = timelineMs - clip.startMs;
      const fontSize = clip.textStyle?.fontSize ?? 32;
      return {
        text: getTextClipPreviewDisplay(
          clip.textContent,
          clip.durationMs,
          elapsedMs,
          clip.textAutoChunk
        ),
        x: width / 2 + (clip.positionX ?? 0),
        y: height / 2 + (clip.positionY ?? 0),
        fontSize,
        fontWeight: clip.textStyle?.fontWeight ?? "normal",
        color: clip.textStyle?.color ?? "#fff",
        align: clip.textStyle?.align ?? "center",
        opacity: clip.enabled === false ? 0 : (clip.opacity ?? 1),
        maxWidth: width * 0.8,
        lineHeight: Math.max(1, fontSize * 1.2),
      };
    });
}

async function renderOfflineAudioMix(
  audioClips: AudioClipDescriptor[],
  durationMs: number
): Promise<AudioBuffer> {
  const sampleRate = 48_000;
  const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * sampleRate));
  const context = new OfflineAudioContext(2, frameCount, sampleRate);

  await Promise.all(
    audioClips
      .filter((clip) => !clip.trackMuted && !clip.muted && clip.volume > 0)
      .map(async (clip) => {
        // eslint-disable-next-line no-restricted-globals -- export audio mix needs arbitrary signed asset URLs
        const response = await fetch(clip.assetUrl);
        if (!response.ok) {
          throw new Error("A required audio asset could not be fetched.");
        }
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer()
        );
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = clip.speed;
        gain.gain.value = clip.volume;
        source.connect(gain);
        gain.connect(context.destination);
        source.start(
          clip.startMs / 1000,
          clip.trimStartMs / 1000,
          clip.durationMs / 1000
        );
      })
  );

  return context.startRendering();
}

function parseResolution(resolution: string): {
  width: number;
  height: number;
} {
  const [rawWidth, rawHeight] = resolution.split("x");
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: 1080, height: 1920 };
  }
  return { width, height };
}

function estimateVideoBitrate(
  width: number,
  height: number,
  fps: number
): number {
  const pixels = width * height;
  const fpsFactor = fps / 30;
  return Math.round(Math.max(2_500_000, pixels * 2.2 * fpsFactor));
}

function collectRenderableAssetIds(tracks: Track[]): string[] {
  const assetIds = new Set<string>();
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (
        (clip.type === "video" ||
          clip.type === "audio" ||
          clip.type === "music") &&
        clip.assetId
      ) {
        assetIds.add(clip.assetId);
      }
    }
  }
  return Array.from(assetIds);
}

function collectVideoAssetIds(tracks: Track[]): string[] {
  const assetIds = new Set<string>();
  for (const track of tracks) {
    if (track.type !== "video") continue;
    for (const clip of track.clips) {
      if (clip.type === "video" && clip.assetId) {
        assetIds.add(clip.assetId);
      }
    }
  }
  return Array.from(assetIds);
}
