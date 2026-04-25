// ─── Shared account types ─────────────────────────────────────────────────────

export type Section =
  | "overview"
  | "subscription"
  | "usage"
  | "orders"
  | "preferences"
  | "profile";

export interface SidebarUsage {
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number | null;
  contentGenerated: number;
  contentGeneratedLimit: number | null;
  queueSize: number;
  queueLimit: number | null;
}

export type {
  AiDefaultsData,
  UserSettingsData,
  VideoDefaultsData,
  Voice,
} from "@contracts/customer";
