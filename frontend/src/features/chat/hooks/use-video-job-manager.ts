import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { useVideoJob } from "@/features/video/hooks/use-video-job";
import type { VideoJobResponse } from "@/features/video/types/video.types";
import {
  clearPersistedStudioVideoJob,
  persistStudioVideoJob,
} from "@/features/video/lib/studio-video-job-storage";
import type { SessionDraft } from "../types/chat.types";
import { reelGeneratingToastDescription } from "../lib/video-job-toast-copy";
import {
  tryRestoreVideoJobFromDrafts,
  tryRestoreVideoJobFromPersistence,
} from "../lib/studio-video-job-restore-logic";

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
  const [videoJobContentId, setVideoJobContentId] = useState<number | null>(
    null
  );
  const [reelProgressToastHiddenByUser, setReelProgressToastHiddenByUser] =
    useState(false);

  const { data: videoJobData } = useVideoJob(videoJobId);
  const prevVideoStatusRef = useRef<string | null>(null);
  const videoJobToastIdRef = useRef<string | number | null>(null);
  const prevSessionIdRef = useRef<string>("");

  const description = useMemo(
    () => reelGeneratingToastDescription(videoJobData, t),
    [
      videoJobData?.job.progress?.shotsCompleted,
      videoJobData?.job.progress?.totalShots,
      t,
      videoJobData,
    ]
  );

  const reelGeneratingToastOpts = useCallback(
    (desc: string) => ({
      description: desc,
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

  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    void (async () => {
      const restored = await tryRestoreVideoJobFromPersistence(sessionId);
      if (cancelled || !restored) return;
      setVideoJobId((prev) => prev ?? restored.jobId);
      setVideoJobContentId((prev) => prev ?? restored.contentId);
      setReelProgressToastHiddenByUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, userId]);

  useEffect(() => {
    if (!sessionId || !userId || !drafts?.length) return;
    let cancelled = false;
    void (async () => {
      const restored = await tryRestoreVideoJobFromDrafts(sessionId, drafts);
      if (cancelled || !restored) return;
      setVideoJobId((prev) => prev ?? restored.jobId);
      setVideoJobContentId((prev) => prev ?? restored.contentId);
      setReelProgressToastHiddenByUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, userId, drafts]);

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
        reelGeneratingToastOpts(description)
      );
    }
  }, [
    videoJobData?.job.status,
    videoJobId,
    t,
    reelGeneratingToastOpts,
    reelProgressToastHiddenByUser,
    description,
  ]);

  useEffect(() => {
    if (videoJobToastIdRef.current == null) return;
    const status = videoJobData?.job.status;
    if (status !== "queued" && status !== "running") return;

    toast.loading(t("workspace_video_generating"), {
      id: videoJobToastIdRef.current,
      ...reelGeneratingToastOpts(description),
    });
  }, [videoJobData?.job.status, description, t, reelGeneratingToastOpts]);

  useEffect(() => {
    const status = videoJobData?.job.status ?? null;
    const prev = prevVideoStatusRef.current;
    prevVideoStatusRef.current = status;

    if (status === "completed") {
      setVideoJobId(null);
      setVideoJobContentId(null);
      if (sessionId) clearPersistedStudioVideoJob(sessionId);
      void invalidateContentAssetsForGeneration(
        queryClient,
        videoJobContentId ?? 0
      );
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
        reelGeneratingToastOpts(
          t("workspace_video_generating_toast_description")
        )
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
      reelGeneratingToastOpts(description)
    );
  }, [videoJobData?.job.status, description, t, reelGeneratingToastOpts]);

  const reelJobRunning =
    videoJobId !== null &&
    (videoJobData?.job.status === "queued" ||
      videoJobData?.job.status === "running");

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
