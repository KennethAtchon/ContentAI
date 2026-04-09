/**
 * Seeds caption presets on startup.
 * Uses ON CONFLICT DO NOTHING — safe to call on every startup.
 */

import { captionPresetRepository } from "@/domain/singletons";
import { SEEDED_CAPTION_PRESETS } from "@/domain/editor/captions/preset-seed";
import { debugLog } from "@/utils/debug/debug";

export async function seedCaptionPresets(): Promise<void> {
  try {
    await captionPresetRepository.seedPresetsIfEmpty(SEEDED_CAPTION_PRESETS);

    debugLog.info(
      `Caption presets seeded (${SEEDED_CAPTION_PRESETS.length} presets)`,
      {
        service: "caption-preset-seed",
        operation: "seed",
      },
    );
  } catch (error) {
    debugLog.error("Failed to seed caption presets", {
      service: "caption-preset-seed",
      operation: "seed",
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-fatal — server should still start
  }
}
