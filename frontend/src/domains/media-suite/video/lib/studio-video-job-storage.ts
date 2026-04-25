import type { SessionDraft } from "@/domains/chat/model/chat.types";

const storageKey = (sessionId: string) =>
  `contentai:studioVideoJob:${sessionId}`;

/** Draft metadata may include phase4.assembly (see backend updatePhase4Metadata). */
export function findActiveReelJobCandidateFromDrafts(
  drafts: SessionDraft[]
): { jobId: string; contentId: number } | null {
  for (const d of drafts) {
    const meta = d.generatedMetadata as
      | Record<string, unknown>
      | null
      | undefined;
    const phase4 = meta?.phase4 as Record<string, unknown> | undefined;
    const assembly = phase4?.assembly as Record<string, unknown> | undefined;
    const jobId = assembly?.jobId;
    const status = assembly?.status;
    if (
      typeof jobId === "string" &&
      (status === "queued" || status === "running")
    ) {
      return { jobId, contentId: d.id };
    }
  }
  return null;
}

export type PersistedStudioVideoJob = {
  jobId: string;
  contentId: number;
};

export function readPersistedStudioVideoJob(
  sessionId: string
): PersistedStudioVideoJob | null {
  if (typeof window === "undefined" || !sessionId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStudioVideoJob;
    if (
      typeof parsed.jobId === "string" &&
      typeof parsed.contentId === "number"
    ) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function persistStudioVideoJob(
  sessionId: string,
  job: PersistedStudioVideoJob
): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    sessionStorage.setItem(storageKey(sessionId), JSON.stringify(job));
  } catch {
    // quota / private mode
  }
}

export function clearPersistedStudioVideoJob(sessionId: string): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // ignore
  }
}
