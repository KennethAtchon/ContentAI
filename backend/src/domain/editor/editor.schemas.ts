import { z } from "zod";

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

const baseClipSchema = {
  id: z.string().min(1),
  startMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  durationMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
};

const visualClipSchema = {
  label: z.string().max(200),
  speed: z.number().min(0.1).max(10),
  enabled: z.boolean(),
  opacity: z.number().min(0).max(1),
  warmth: z.number().min(-100).max(100),
  contrast: z.number().min(-100).max(100),
  positionX: z.number(),
  positionY: z.number(),
  scale: z.number().min(0.01).max(10),
  rotation: z.number().min(-360).max(360),
};

const mediaClipSchema = {
  assetId: z.string().nullable(),
  trimStartMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  trimEndMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  sourceMaxDurationMs: z
    .preprocess(roundFiniteMs, z.number().int().min(0))
    .optional(),
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
};

const textStyleSchema = z.object({
  fontSize: z.number(),
  fontWeight: z.enum(["normal", "bold"]),
  color: z.string(),
  align: z.enum(["left", "center", "right"]),
});

const videoClipSchema = z.object({
  ...baseClipSchema,
  ...visualClipSchema,
  ...mediaClipSchema,
  type: z.literal("video"),
  isPlaceholder: z.literal(true).optional(),
  placeholderShotIndex: z.number().int().min(0).optional(),
  placeholderLabel: z.string().max(200).optional(),
  placeholderStatus: z.enum(["pending", "generating", "failed"]).optional(),
});

const audioClipSchema = z.object({
  ...baseClipSchema,
  ...visualClipSchema,
  ...mediaClipSchema,
  type: z.literal("audio"),
});

const musicClipSchema = z.object({
  ...baseClipSchema,
  ...visualClipSchema,
  ...mediaClipSchema,
  type: z.literal("music"),
});

const textClipSchema = z.object({
  ...baseClipSchema,
  ...visualClipSchema,
  type: z.literal("text"),
  textContent: z.string().max(2000),
  textAutoChunk: z.boolean(),
  textStyle: textStyleSchema.optional(),
});

const captionClipSchema = z.object({
  ...baseClipSchema,
  type: z.literal("caption"),
  originVoiceoverClipId: z.string().min(1).nullable(),
  captionDocId: z.string().min(1),
  sourceStartMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  sourceEndMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  stylePresetId: z.string().min(1),
  styleOverrides: z
    .object({
      positionY: z.number().optional(),
      fontSize: z.number().optional(),
      textTransform: z.enum(["none", "uppercase", "lowercase"]).optional(),
    })
    .default({}),
  groupingMs: z.preprocess(roundFiniteMs, z.number().int().min(1)),
});

const timelineClipSchema = z.discriminatedUnion("type", [
  videoClipSchema,
  audioClipSchema,
  musicClipSchema,
  textClipSchema,
  captionClipSchema,
]);

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
  clips: z.array(timelineClipSchema),
  transitions: z.array(transitionSchema).default([]),
});

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
  musicVolume: z.number().min(0).max(1),
  totalDuration: z.number().int().min(1000).max(120000),
});

export const aiAssembleRequestSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube-shorts"]),
});

export const transcribeCaptionsSchema = z.object({
  assetId: z.string().min(1),
  force: z.boolean().optional(),
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

export const captionDocIdParamSchema = z.object({
  captionDocId: z.string().min(1),
});

const captionTokenInputSchema = z.object({
  text: z.string().trim().min(1).max(200),
  startMs: z.preprocess(roundFiniteMs, z.number().int().min(0)),
  endMs: z.preprocess(roundFiniteMs, z.number().int().min(1)),
});

function validateCaptionTokens(
  tokens: Array<z.infer<typeof captionTokenInputSchema>>,
  ctx: z.RefinementCtx,
) {
  if (tokens.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one token is required",
      path: ["tokens"],
    });
    return;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.startMs >= token.endMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token startMs must be less than endMs",
        path: ["tokens", i, "startMs"],
      });
    }

    if (i > 0) {
      const previous = tokens[i - 1]!;
      if (previous.startMs > token.startMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tokens must be sorted by startMs",
          path: ["tokens", i, "startMs"],
        });
      }
      if (previous.endMs > token.startMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tokens must not overlap",
          path: ["tokens", i, "startMs"],
        });
      }
    }
  }
}

export const manualCaptionDocSchema = z
  .object({
    assetId: z.string().min(1).nullable(),
    tokens: z.array(captionTokenInputSchema),
    fullText: z.string().trim().min(1),
    language: z.literal("en"),
  })
  .superRefine((value, ctx) => {
    validateCaptionTokens(value.tokens, ctx);
  });

export const patchCaptionDocSchema = z
  .object({
    tokens: z.array(captionTokenInputSchema),
    fullText: z.string().trim().min(1),
    language: z.literal("en"),
  })
  .superRefine((value, ctx) => {
    validateCaptionTokens(value.tokens, ctx);
  });

export const editorAssetsQuerySchema = z.object({
  contentId: z.coerce.number().int().positive().optional(),
  role: z.string().trim().optional(),
});
