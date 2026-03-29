import type {
  IConfigRepository,
  UserSettingsUpsertInput,
} from "@/domain/config/config.repository";
import type { UserSettings } from "@/infrastructure/database/drizzle/schema";

export type { UserSettingsUpsertInput as UserSettingsInput };

export class UserSettingsService {
  constructor(private readonly config: IConfigRepository) {}

  async get(userId: string): Promise<UserSettings | null> {
    return this.config.findUserSettingsByUserId(userId);
  }

  async upsert(
    userId: string,
    input: UserSettingsUpsertInput,
  ): Promise<UserSettings> {
    return this.config.upsertUserSettings(userId, input);
  }

  async reset(userId: string): Promise<void> {
    await this.config.resetUserSettings(userId);
  }
}
