import { z } from "zod";

/** Cap dragged clip duration to avoid absurd values from malformed payloads. */
const MAX_DRAG_DURATION_MS = 24 * 60 * 60 * 1000;

const timelineAssetDragPayloadSchema = z.object({
  assetId: z.string().min(1),
  type: z.string(),
  durationMs: z.number().finite().nonnegative().nullish(),
  label: z.string().optional().default(""),
});

export type ParsedTimelineAssetDrag = {
  assetId: string;
  type: string;
  durationMs: number;
  label: string;
};

export function parseTimelineAssetDragPayload(
  raw: string
): ParsedTimelineAssetDrag | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = timelineAssetDragPayloadSchema.safeParse(parsed);
  if (!result.success) return null;
  const d = result.data.durationMs;
  const durationMs =
    d == null ? 5000 : Math.min(Math.max(0, d), MAX_DRAG_DURATION_MS);
  return {
    assetId: result.data.assetId,
    type: result.data.type,
    durationMs,
    label: result.data.label,
  };
}
