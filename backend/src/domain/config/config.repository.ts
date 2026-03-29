import { and, eq } from "drizzle-orm";
import {
  systemConfig,
  userSettings,
  type SystemConfig,
  type UserSettings,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface SystemConfigSeedRow {
  category: string;
  key: string;
  value: string | null;
  encryptedValue?: string | null;
  valueType: string;
  isSecret?: boolean;
  description?: string | null;
}

export interface UserSettingsUpsertInput {
  preferredAiProvider?: string | null;
  preferredVideoProvider?: string | null;
  preferredVoiceId?: string | null;
  preferredTtsSpeed?: string | null;
  preferredAspectRatio?: string | null;
}

export interface IConfigRepository {
  insertSystemConfigSeedIfMissing(row: SystemConfigSeedRow): Promise<void>;
  listSystemConfigByCategoryActive(category: string): Promise<SystemConfig[]>;
  listAllSystemConfig(): Promise<SystemConfig[]>;
  upsertSystemConfigRow(params: {
    category: string;
    key: string;
    value: string | null;
    encryptedValue: string | null;
    valueType: string;
    isSecret: boolean;
    updatedBy: string | null;
  }): Promise<void>;
  findUserSettingsByUserId(userId: string): Promise<UserSettings | null>;
  upsertUserSettings(
    userId: string,
    input: UserSettingsUpsertInput,
  ): Promise<UserSettings>;
  resetUserSettings(userId: string): Promise<void>;
}

export class ConfigRepository implements IConfigRepository {
  constructor(private readonly database: AppDb) {}

  async insertSystemConfigSeedIfMissing(row: SystemConfigSeedRow): Promise<void> {
    await this.database
      .insert(systemConfig)
      .values({
        category: row.category,
        key: row.key,
        value: row.value ?? null,
        encryptedValue: row.encryptedValue ?? null,
        valueType: row.valueType,
        isSecret: row.isSecret ?? false,
        description: row.description ?? null,
      })
      .onConflictDoNothing({ target: [systemConfig.category, systemConfig.key] });
  }

  async listSystemConfigByCategoryActive(
    category: string,
  ): Promise<SystemConfig[]> {
    return this.database
      .select()
      .from(systemConfig)
      .where(
        and(
          eq(systemConfig.category, category),
          eq(systemConfig.isActive, true),
        ),
      );
  }

  async listAllSystemConfig(): Promise<SystemConfig[]> {
    return this.database.select().from(systemConfig);
  }

  async upsertSystemConfigRow(params: {
    category: string;
    key: string;
    value: string | null;
    encryptedValue: string | null;
    valueType: string;
    isSecret: boolean;
    updatedBy: string | null;
  }): Promise<void> {
    await this.database
      .insert(systemConfig)
      .values({
        category: params.category,
        key: params.key,
        value: params.value,
        encryptedValue: params.encryptedValue,
        valueType: params.valueType,
        isSecret: params.isSecret,
        updatedBy: params.updatedBy,
      })
      .onConflictDoUpdate({
        target: [systemConfig.category, systemConfig.key],
        set: {
          value: params.value,
          encryptedValue: params.encryptedValue,
          updatedBy: params.updatedBy,
          updatedAt: new Date(),
        },
      });
  }

  async findUserSettingsByUserId(userId: string): Promise<UserSettings | null> {
    const [row] = await this.database
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async upsertUserSettings(
    userId: string,
    input: UserSettingsUpsertInput,
  ): Promise<UserSettings> {
    const [row] = await this.database
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

  async resetUserSettings(userId: string): Promise<void> {
    await this.database
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
