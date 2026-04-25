import type { QueueItem } from "@/domains/reels/model/reel.types";
import type {
  Project,
  QueueDetail,
  StatusFilter,
  VersionGroup,
} from "../ui/queue/queue.types";

export interface QueueListResponse {
  items: QueueItem[];
  total: number;
}

export interface QueueProjectsResponse {
  projects: Project[];
}

export function buildQueueListUrl(params: {
  statusFilter: StatusFilter;
  projectFilter: string;
  searchQuery: string;
}): string {
  const searchParams = new URLSearchParams({ limit: "20" });

  if (params.statusFilter !== "all") {
    searchParams.set("status", params.statusFilter);
  }

  if (params.projectFilter !== "all") {
    searchParams.set("projectId", params.projectFilter);
  }

  if (params.searchQuery) {
    searchParams.set("search", params.searchQuery);
  }

  return `/api/queue?${searchParams.toString()}`;
}

export function buildQueueDetailUrl(detailItemId: number): string {
  return `/api/queue/${detailItemId}/detail`;
}

export function groupQueueItemsByVersion(items: QueueItem[]): VersionGroup[] {
  const groups: VersionGroup[] = [];
  const seen = new Set<number | null>();

  for (const item of items) {
    const key = item.rootContentId;
    if (key != null && seen.has(key)) {
      continue;
    }
    if (key != null) {
      seen.add(key);
    }

    const siblings =
      key != null
        ? items
            .filter((candidate) => candidate.rootContentId === key)
            .sort((a, b) => (a.version ?? 1) - (b.version ?? 1))
        : [item];

    groups.push({ rootContentId: key, items: siblings });
  }

  return groups;
}

export type { QueueDetail };
