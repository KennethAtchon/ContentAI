import {
  clearPersistedStudioVideoJob,
  findActiveReelJobCandidateFromDrafts,
  persistStudioVideoJob,
  readPersistedStudioVideoJob,
} from "@/domains/video/lib/studio-video-job-storage";
import { chatService } from "../api/chat.service";
import type { SessionDraft } from "../model/chat.types";

export type ActiveStudioVideoJob = { jobId: string; contentId: number };

function isActiveJobStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

/**
 * If sessionStorage points at a still-active job, returns ids; otherwise clears bad storage.
 */
export async function tryRestoreVideoJobFromPersistence(
  sessionId: string
): Promise<ActiveStudioVideoJob | null> {
  const persisted = readPersistedStudioVideoJob(sessionId);
  if (!persisted) return null;
  try {
    const data = await chatService.getVideoJob(persisted.jobId);
    const s = data.job.status;
    if (isActiveJobStatus(s)) {
      return { jobId: persisted.jobId, contentId: persisted.contentId };
    }
    clearPersistedStudioVideoJob(sessionId);
    return null;
  } catch {
    clearPersistedStudioVideoJob(sessionId);
    return null;
  }
}

/**
 * When storage is empty, see if draft metadata still references a running job; repersist if so.
 */
export async function tryRestoreVideoJobFromDrafts(
  sessionId: string,
  drafts: SessionDraft[]
): Promise<ActiveStudioVideoJob | null> {
  if (readPersistedStudioVideoJob(sessionId)) return null;
  const candidate = findActiveReelJobCandidateFromDrafts(drafts);
  if (!candidate) return null;
  try {
    const data = await chatService.getVideoJob(candidate.jobId);
    const s = data.job.status;
    if (isActiveJobStatus(s)) {
      persistStudioVideoJob(sessionId, {
        jobId: candidate.jobId,
        contentId: candidate.contentId,
      });
      return { jobId: candidate.jobId, contentId: candidate.contentId };
    }
  } catch {
    /* stale job id in metadata */
  }
  return null;
}
