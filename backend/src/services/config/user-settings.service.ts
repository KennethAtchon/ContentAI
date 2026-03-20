import { db } from "@/services/db/db";
import {
  userSettings,
  type UserSettings,
} from "@/infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";

export interface UserSettingsInput {
  preferredAiProvider?: string | null;
  preferredVideoProvider?: string | null;
  preferredVoiceId?: string | null;
  preferredTtsSpeed?: string | null;
  preferredAspectRatio?: string | null;
}

class UserSettingsService {
  async get(userId: string): Promise<UserSettings | null> {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async upsert(
    userId: string,
    input: UserSettingsInput,
  ): Promise<UserSettings> {
    const [row] = await db
      .insert(userSettings)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...(input.preferredAiProvider !== undefined && {
            preferredAiProvider: input.preferredAiProvider,
          }),
          ...(input.preferredVideoProvider !== undefined && {
            preferredVideoProvider: input.preferredVideoProvider,
          }),
          ...(input.preferredVoiceId !== undefined && {
            preferredVoiceId: input.preferredVoiceId,
          }),
          ...(input.preferredTtsSpeed !== undefined && {
            preferredTtsSpeed: input.preferredTtsSpeed,
          }),
          ...(input.preferredAspectRatio !== undefined && {
            preferredAspectRatio: input.preferredAspectRatio,
          }),
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  async reset(userId: string): Promise<void> {
    await db
      .update(userSettings)
      .set({
        preferredAiProvider: null,
        preferredVideoProvider: null,
        preferredVoiceId: null,
        preferredTtsSpeed: null,
        preferredAspectRatio: null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  }
}

export const userSettingsService = new UserSettingsService();
