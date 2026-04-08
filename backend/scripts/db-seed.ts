import { db } from "../src/services/db/db";
import { captionPresets } from "../src/infrastructure/database/drizzle/schema";
import { SEEDED_CAPTION_PRESETS } from "../src/domain/editor/captions/preset-seed";

await db
  .insert(captionPresets)
  .values(
    SEEDED_CAPTION_PRESETS.map((p) => ({
      id: p.id,
      definition: p as unknown as Record<string, unknown>,
    }))
  )
  .onConflictDoNothing();

console.log(`Seeded ${SEEDED_CAPTION_PRESETS.length} caption presets.`);
process.exit(0);
