import { eq } from "drizzle-orm";
import {
  captionPresets,
  type CaptionPreset,
} from "../../../infrastructure/database/drizzle/schema";
import type { CaptionStyleOverrides } from "../../../types/timeline.types";
import type { AppDb } from "../../database.types";
import type { TextPreset } from "./types";

export interface CaptionPresetRecord extends TextPreset {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICaptionPresetRepository {
  getCaptionPreset(id: string): Promise<CaptionPresetRecord | null>;
  listCaptionPresets(): Promise<CaptionPresetRecord[]>;
  seedPresetsIfEmpty(presets: readonly TextPreset[]): Promise<void>;
}

function mapRow(row: CaptionPreset): CaptionPresetRecord {
  return {
    ...(row.definition as unknown as TextPreset),
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function applyOverrides(
  preset: TextPreset,
  overrides: CaptionStyleOverrides,
): TextPreset {
  return {
    ...preset,
    typography: {
      ...preset.typography,
      fontSize: overrides.fontSize ?? preset.typography.fontSize,
      textTransform: overrides.textTransform ?? preset.typography.textTransform,
    },
    layout: {
      ...preset.layout,
      positionY: overrides.positionY ?? preset.layout.positionY,
    },
  };
}

export class CaptionPresetRepository implements ICaptionPresetRepository {
  private cache = new Map<string, CaptionPresetRecord>();
  private listCache: CaptionPresetRecord[] | null = null;

  constructor(private readonly db: AppDb) {}

  async getCaptionPreset(id: string): Promise<CaptionPresetRecord | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id) ?? null;
    }

    const [row] = await this.db
      .select()
      .from(captionPresets)
      .where(eq(captionPresets.id, id))
      .limit(1);
    if (!row) return null;

    const mapped = mapRow(row);
    this.cache.set(mapped.id, mapped);
    return mapped;
  }

  async seedPresetsIfEmpty(presets: readonly TextPreset[]): Promise<void> {
    const rows = await this.db.select().from(captionPresets);
    if (rows.length > 0) return;

    await this.db
      .insert(captionPresets)
      .values(
        presets.map((p) => ({
          id: p.id,
          definition: p,
        })),
      )
      .onConflictDoNothing();

    // Invalidate list cache so next call re-fetches fresh rows
    this.listCache = null;
  }

  async listCaptionPresets(): Promise<CaptionPresetRecord[]> {
    if (this.listCache) {
      return this.listCache;
    }

    const rows = await this.db.select().from(captionPresets);
    const mapped = rows.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
    this.listCache = mapped;
    for (const preset of mapped) {
      this.cache.set(preset.id, preset);
    }
    return mapped;
  }
}
