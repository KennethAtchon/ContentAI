import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
export type { UsageStats } from "@contracts/customer";

export type ContentType = string;

export interface GenerationHistory {
  id: string;
  type: ContentType;
  sourceReel: {
    username: string;
    hook: string;
  };
  prompt: string;
  createdAt: Date;
  generationTime: number;
}

export interface GenerationHistoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface GenerationHistoryResponse {
  data: GenerationHistory[];
  pagination: GenerationHistoryPagination;
}

export const HISTORY_PAGE_LIMIT = 10;

export function buildGenerationHistoryUrl(page: number): string {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: HISTORY_PAGE_LIMIT.toString(),
  });
  return `/api/generation/history?${params.toString()}`;
}

export function exportUsageCsv(): Promise<{ url: string }> {
  return authenticatedFetchJson<{ url: string }>("/api/customer/export", {
    method: "POST",
    body: JSON.stringify({ format: "csv" }),
  });
}
