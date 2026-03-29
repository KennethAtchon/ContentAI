import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { useVideoJob } from "@/features/video/hooks/use-video-job";
import type { VideoJobResponse } from "@/features/video/types/video.types";
import {
  clearPersistedStudioVideoJob,
  findActiveReelJobCandidateFromDrafts,
  persistStudioVideoJob,
  readPersistedStudioVideoJob,
} from "@/features/video/lib/studio-video-job-storage";
import type { SessionDraft } from "../types/chat.types";

interface UseVideoJobManagerParams {
  sessionId: string;
  userId: string | undefined;
  drafts: SessionDraft[] | undefined;
}

export interface VideoJobManager {
  videoJobId: string | null;
  videoJobContentId: number | null;
  videoJobData: VideoJobResponse | undefined;
  reelJobRunning: boolean;
  showReelProgressRecall: boolean;
  handleVideoJobStarted: (jobId: string, contentId: number) => void;
  handleShowReelProgressToast: () => void;
}

export function useVideoJobManager({
  sessionId,
  userId,
  drafts,
}: UseVideoJobManagerParams): VideoJobManager {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoJobContentId, setVideoJobContentId] = useState<number | null>(null);
  const [reelProgressToastHiddenByUser, setReelProgressToastHiddenByUser] =
    useState(false);

  const { data: videoJobData } = useVideoJob(videoJobId);
  const prevVideoStatusRef = useRef<string | null>(null);
  const videoJobToastIdRef = useRef<string | number | null>(null);
  const prevSessionIdRef = useRef<string>("");

  const reelGeneratingDescription = useMemo(() => {
    const progress = videoJobData?.job.progress;
    const { shotsCompleted, totalShots } = progress ?? {};
    if (shotsCompleted !== undefined && totalShots !== undefined && totalShots > 0) {
      return t("workspace_video_generating_toast_shot_progress", {
        completed: shotsCompleted,
        total: totalShots,
      });
    }
    return t("workspace_video_generating_toast_description");
  }, [videoJobData?.job.progress?.shotsCompleted, videoJobData?.job.progress?.totalShots, t]);

  const reelGeneratingToastOpts = useCallback(
    (description: string) => ({
      description,
      duration: Infinity,
      closeButton: true,
      onDismiss: () => {
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(true);
      },
      cancel: {
        label: t("workspace_video_generating_toast_hide"),
        onClick: () => {
          const id = videoJobToastIdRef.current;
          if (id != null) toast.dismiss(id);
          videoJobToastIdRef.current = null;
          setReelProgressToastHiddenByUser(true);
        },
      },
    }),
    [t]
  );

  // Clear in-flight video job when switching chat sessions.
  useEffect(() => {
    if (prevSessionIdRef.current === sessionId) return;
    const hadPreviousSession = prevSessionIdRef.current !== "";
    prevSessionIdRef.current = sessionId;
    if (!hadPreviousSession) return;

    setVideoJobId(null);
    setVideoJobContentId(null);
    prevVideoStatusRef.current = null;
    setReelProgressToastHiddenByUser(false);
    if (videoJobToastIdRef.current != null) {
      toast.dismiss(videoJobToastIdRef.current);
      videoJobToastIdRef.current = null;
    }
  }, [sessionId]);

  // Restore in-flight video job from sessionStorage after refresh / new tab.
  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;

    void (async () => {
      const persisted = readPersistedStudioVideoJob(sessionId);
      if (!persisted) return;
      try {
        const data = await authenticatedFetchJson<VideoJobResponse>(
          `/api/video/jobs/${persisted.jobId}`
        );
        if (cancelled) return;
        const s = data.job.status;
        if (s === "queued" || s === "running") {
          setVideoJobId((prev) => prev ?? persisted.jobId);
          setVideoJobContentId((prev) => prev ?? persisted.contentId);
          setReelProgressToastHiddenByUser(false);
        } else {
          clearPersistedStudioVideoJob(sessionId);
        }
      } catch {
        if (!cancelled) clearPersistedStudioVideoJob(sessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, userId]);

  // Fallback when storage was cleared: scan draft metadata for an active job.
  useEffect(() => {
    if (!sessionId || !userId) return;
    if (readPersistedStudioVideoJob(sessionId)) return;
    if (!drafts?.length) return;

    let cancelled = false;
    const candidate = findActiveReelJobCandidateFromDrafts(drafts);
    if (!candidate) return;

    void (async () => {
      try {
        const data = await authenticatedFetchJson<VideoJobResponse>(
          `/api/video/jobs/${candidate.jobId}`
        );
        if (cancelled) return;
        const s = data.job.status;
        if (s === "queued" || s === "running") {
          setVideoJobId((prev) => prev ?? candidate.jobId);
          setVideoJobContentId((prev) => prev ?? candidate.contentId);
          setReelProgressToastHiddenByUser(false);
          persistStudioVideoJob(sessionId, { jobId: candidate.jobId, contentId: candidate.contentId });
        }
      } catch {
        // stale job id in metadata — ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, userId, drafts]);

  // Restore loading toast if a job was already running (panel closed/reopened).
  useEffect(() => {
    const status = videoJobData?.job.status;
    if (
      (status === "queued" || status === "running") &&
      videoJobToastIdRef.current === null &&
      videoJobId !== null &&
      !reelProgressToastHiddenByUser
    ) {
      videoJobToastIdRef.current = toast.loading(
        t("workspace_video_generating"),
        reelGeneratingToastOpts(reelGeneratingDescription)
      );
    }
  }, [
    videoJobData?.job.status,
    videoJobId,
    t,
    reelGeneratingToastOpts,
    reelProgressToastHiddenByUser,
    reelGeneratingDescription,
  ]);

  // Keep toast copy in sync with shot progress.
  useEffect(() => {
    if (videoJobToastIdRef.current == null) return;
    const status = videoJobData?.job.status;
    if (status !== "queued" && status !== "running") return;

    toast.loading(t("workspace_video_generating"), {
      id: videoJobToastIdRef.current,
      ...reelGeneratingToastOpts(reelGeneratingDescription),
    });
  }, [videoJobData?.job.status, reelGeneratingDescription, t, reelGeneratingToastOpts]);

  // Handle job completion / failure transitions.
  useEffect(() => {
    const status = videoJobData?.job.status ?? null;
    const prev = prevVideoStatusRef.current;
    prevVideoStatusRef.current = status;

    if (status === "completed") {
      setVideoJobId(null);
      setVideoJobContentId(null);
      if (sessionId) clearPersistedStudioVideoJob(sessionId);
      void invalidateContentAssetsForGeneration(queryClient, videoJobContentId ?? 0);
      if (prev !== "completed") {
        const tid = videoJobToastIdRef.current;
        toast.success(t("workspace_video_ready"), {
          ...(tid != null ? { id: tid } : {}),
          description: t("workspace_video_ready_toast_description"),
          duration: 6000,
          closeButton: true,
        });
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(false);
      }
    } else if (status === "failed") {
      setVideoJobId(null);
      setVideoJobContentId(null);
      if (sessionId) clearPersistedStudioVideoJob(sessionId);
      if (prev !== "failed") {
        const tid = videoJobToastIdRef.current;
        toast.error(t("workspace_video_failed"), {
          ...(tid != null ? { id: tid } : {}),
          description: videoJobData?.job.error ?? undefined,
          duration: 8000,
          closeButton: true,
        });
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(false);
      }
    }
  }, [
    videoJobData?.job.status,
    videoJobData?.job.error,
    t,
    queryClient,
    videoJobContentId,
    sessionId,
  ]);

  const handleVideoJobStarted = useCallback(
    (jobId: string, contentId: number) => {
      setReelProgressToastHiddenByUser(false);
      setVideoJobId(jobId);
      setVideoJobContentId(contentId);
      if (sessionId) {
        persistStudioVideoJob(sessionId, { jobId, contentId });
      }
      videoJobToastIdRef.current = toast.loading(
        t("workspace_video_generating"),
        reelGeneratingToastOpts(t("workspace_video_generating_toast_description"))
      );
    },
    [t, reelGeneratingToastOpts, sessionId]
  );

  const handleShowReelProgressToast = useCallback(() => {
    if (videoJobToastIdRef.current != null) return;
    const status = videoJobData?.job.status;
    if (status !== "queued" && status !== "running") return;
    setReelProgressToastHiddenByUser(false);
    videoJobToastIdRef.current = toast.loading(
      t("workspace_video_generating"),
      reelGeneratingToastOpts(reelGeneratingDescription)
    );
  }, [videoJobData?.job.status, reelGeneratingDescription, t, reelGeneratingToastOpts]);

  const reelJobRunning =
    videoJobId !== null &&
    (videoJobData?.job.status === "queued" || videoJobData?.job.status === "running");

  return {
    videoJobId,
    videoJobContentId,
    videoJobData,
    reelJobRunning,
    showReelProgressRecall: reelJobRunning && reelProgressToastHiddenByUser,
    handleVideoJobStarted,
    handleShowReelProgressToast,
  };
}
