import { z } from "zod";

/** Clients may send fractional ms (e.g. split at sub-frame playhead); normalize for Zod int + DB. */
function roundFiniteMs(val: unknown): unknown {
  if (typeof val === "number" && Number.isFinite(val)) {
    return Math.round(val);
  }
  return val;
}

export const resolutionEnum = z.enum([
  "1080x1920",
  "720x1280",
  "2160x3840",
  "1920x1080",
  "1080x1080",
]);

const clipDataSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable(),
  label: z.string().max(200),
  startMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  durationMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  trimStartMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  trimEndMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  sourceMaxDurationMs: z
    .preprocess(roundFiniteMs, z.number().int().min(0))
    .optional(),
  speed: z.number().min(0.1).max(10),
  opacity: z.number().min(0).max(1),
  warmth: z.number().min(-100).max(100),
  contrast: z.number().min(-100).max(100),
  positionX: z.number(),
  positionY: z.number(),
  scale: z.number().min(0.01).max(10),
  rotation: z.number().min(-360).max(360),
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
  enabled: z.boolean().optional(),
  textContent: z.string().max(2000).optional(),
  textAutoChunk: z.boolean().optional(),
  textStyle: z
    .object({
      fontSize: z.number(),
      fontWeight: z.enum(["normal", "bold"]),
      color: z.string(),
      align: z.enum(["left", "center", "right"]),
    })
    .optional(),
  captionId: z.string().optional(),
  captionWords: z
    .array(
      z.object({
        word: z.string(),
        startMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
        endMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
      }),
    )
    .optional(),
  captionPresetId: z.string().max(50).optional(),
  captionGroupSize: z.number().int().min(1).max(10).optional(),
  captionPositionY: z.number().min(0).max(100).optional(),
  captionFontSizeOverride: z.number().int().min(8).max(200).optional(),
  /** Shot placeholders before generation completes — must be preserved on parse (Zod strips unknown keys). */
  isPlaceholder: z.literal(true).optional(),
  placeholderShotIndex: z.number().int().min(0).optional(),
  placeholderLabel: z.string().max(200).optional(),
  placeholderStatus: z
    .enum(["pending", "generating", "failed"])
    .optional(),
});

const transitionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "fade",
    "slide-left",
    "slide-up",
    "dissolve",
    "wipe-right",
    "none",
  ]),
  durationMs: z.preprocess(roundFiniteMs, z.number().int().min(200).max(2000)),
  clipAId: z.string().min(1),
  clipBId: z.string().min(1),
});

export const editorTrackDataSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["video", "audio", "music", "text"]),
  name: z.string().min(1),
  muted: z.boolean(),
  locked: z.boolean(),
  clips: z.array(clipDataSchema),
  transitions: z.array(transitionSchema).optional(),
});

/** Validates `edit_projects.tracks` JSONB on read (GET project). */
export const editorStoredTracksSchema = z.array(editorTrackDataSchema);

export const patchProjectSchema = z.object({
  title: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.optional(z.string().min(1).max(200)),
  ),
  tracks: z.array(editorTrackDataSchema).optional(),
  durationMs: z.optional(z.preprocess(roundFiniteMs, z.number().int().min(0))),
  fps: z.optional(
    z.preprocess(roundFiniteMs, z.number().int().min(1).max(120)),
  ),
  resolution: resolutionEnum.optional(),
});

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  generatedContentId: z.number().int().optional(),
});

export const exportSchema = z.object({
  resolution: resolutionEnum.optional(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
});

export const aiAssemblyResponseSchema = z.object({
  shotOrder: z.array(z.number().int().min(0)),
  cuts: z.array(
    z.object({
      shotIndex: z.number().int().min(0),
      trimStartMs: z.number().int().min(0),
      trimEndMs: z.number().int().min(0),
      transition: z.enum(["cut", "fade", "slide-left", "dissolve"]),
    }),
  ),
  captionStyle: z
    .enum(["hormozi", "clean-minimal", "dark-box", "karaoke", "bold-outline"])
    .optional(),
  captionGroupSize: z.number().int().min(1).max(6).optional(),
  musicVolume: z.number().min(0).max(1),
  totalDuration: z.number().int().min(1000).max(120000),
});

export const aiAssembleRequestSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube-shorts"]),
});

export const transcribeCaptionsSchema = z.object({
  assetId: z.string().min(1),
});

export const forkProjectSchema = z.object({
  resetToAI: z.boolean().optional(),
});

export const editorProjectIdParamSchema = z.object({
  id: z.string().min(1),
});

export const editorSnapshotParamSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
});

export const captionAssetIdParamSchema = z.object({
  assetId: z.string().min(1),
});

export const editorAssetsQuerySchema = z.object({
  contentId: z.coerce.number().int().positive().optional(),
  role: z.string().trim().optional(),
});
