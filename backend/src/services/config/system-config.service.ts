/**
 * SystemConfigService
 *
 * DB-backed runtime configuration with Redis caching.
 * Fallback chain: DB → ENV fallback supplied by caller → code default.
 *
 * All secrets (isSecret=true) are encrypted at rest.
 * getAll() redacts encrypted values so they are never sent over the wire.
 */

import type { IConfigRepository } from "@/domain/config/config.repository";
import type { SystemConfig } from "@/infrastructure/database/drizzle/schema";
import { encrypt, decrypt } from "@/utils/crypto/encryption";
import { debugLog } from "@/utils/debug/debug";

const CACHE_TTL_SECONDS = 60;

export class SystemConfigService {
  constructor(private readonly config: IConfigRepository) {}

  private getRedis() {
    try {
      const getRedisConnection = require("@/services/db/redis")
        .default as () => import("ioredis").default;
      return getRedisConnection();
    } catch {
      return null;
    }
  }

  private cacheKey(category: string): string {
    return `sys_cfg:${category}`;
  }

  private async readCache(category: string): Promise<SystemConfig[] | null> {
    try {
      const redis = this.getRedis();
      if (!redis) return null;
      const raw = await redis.get(this.cacheKey(category));
      if (!raw) return null;
      return JSON.parse(raw) as SystemConfig[];
    } catch {
      return null;
    }
  }

  private async writeCache(
    category: string,
    rows: SystemConfig[],
  ): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;
      await redis.set(
        this.cacheKey(category),
        JSON.stringify(rows),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Cache failures are non-fatal
    }
  }

  async invalidateCache(category: string): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;
      if (category === "all") {
        const keys = await redis.keys("sys_cfg:*");
        if (keys.length > 0) await redis.del(...keys);
      } else {
        await redis.del(this.cacheKey(category));
      }
    } catch {
      // non-fatal
    }
  }

  private async getRows(category: string): Promise<SystemConfig[]> {
    const cached = await this.readCache(category);
    if (cached) return cached;

    const rows = await this.config.listSystemConfigByCategoryActive(category);

    await this.writeCache(category, rows);
    return rows;
  }

  private resolveValue(row: SystemConfig): string | null {
    if (!row.isSecret) return row.value;
    if (!row.encryptedValue) return null;
    try {
      return decrypt(row.encryptedValue);
    } catch {
      debugLog.warn("Failed to decrypt config value", {
        service: "system-config",
        key: `${row.category}.${row.key}`,
      });
      return null;
    }
  }

  async get(category: string, key: string): Promise<string | null> {
    const rows = await this.getRows(category);
    const row = rows.find((r) => r.key === key);
    if (!row) return null;
    return this.resolveValue(row);
  }

  async getNumber(
    category: string,
    key: string,
    fallback: number,
  ): Promise<number> {
    const val = await this.get(category, key);
    if (val === null) return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  }

  async getBoolean(
    category: string,
    key: string,
    fallback: boolean,
  ): Promise<boolean> {
    const val = await this.get(category, key);
    if (val === null) return fallback;
    return val === "true" || val === "1";
  }

  async getJson<T>(category: string, key: string, fallback: T): Promise<T> {
    const val = await this.get(category, key);
    if (!val) return fallback;
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }

  async getCategory(category: string): Promise<Record<string, string | null>> {
    const rows = await this.getRows(category);
    return Object.fromEntries(rows.map((r) => [r.key, this.resolveValue(r)]));
  }

  async set(
    category: string,
    key: string,
    value: unknown,
    updatedBy?: string,
  ): Promise<void> {
    const rows = await this.getRows(category);
    const existing = rows.find((r) => r.key === key);

    let stringValue: string | null = null;
    let encryptedValue: string | null = null;

    if (existing?.isSecret) {
      if (value !== null && value !== undefined && String(value) !== "") {
        encryptedValue = encrypt(String(value));
      } else {
        encryptedValue = existing.encryptedValue ?? null;
      }
    } else {
      stringValue =
        typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    }

    await this.config.upsertSystemConfigRow({
      category,
      key,
      value: stringValue,
      encryptedValue,
      valueType: existing?.valueType ?? "string",
      isSecret: existing?.isSecret ?? false,
      updatedBy: updatedBy ?? null,
    });

    await this.invalidateCache(category);
  }

  /** Returns all config rows. Secrets show value="[ENCRYPTED]" and encryptedValue=null. */
  async getAll(): Promise<SystemConfig[]> {
    const rows = await this.config.listAllSystemConfig();
    return rows.map((r) =>
      r.isSecret
        ? {
            ...r,
            value: r.encryptedValue ? "[ENCRYPTED]" : null,
            encryptedValue: null,
          }
        : r,
    );
  }

  /** Returns all rows for one category. Secrets are redacted. */
  async getCategoryPublic(category: string): Promise<SystemConfig[]> {
    const rows = await this.getRows(category);
    return rows.map((r) =>
      r.isSecret
        ? {
            ...r,
            value: r.encryptedValue ? "[ENCRYPTED]" : null,
            encryptedValue: null,
          }
        : r,
    );
  }

  /** Gets an API key from the api_keys category, decrypts it, falls back to the given ENV value. */
  async getApiKey(key: string, envFallback: string): Promise<string> {
    try {
      const val = await this.get("api_keys", key);
      if (val && val.trim()) return val.trim();
    } catch {
      // fall through
    }
    return envFallback;
  }

  /** Returns true if a non-empty API key exists in DB or ENV for the given api_keys entry. */
  async hasApiKey(key: string, envFallback: string): Promise<boolean> {
    const val = await this.getApiKey(key, envFallback);
    return !!val;
  }
}
