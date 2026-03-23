import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, FileText, Mic, Film } from "lucide-react";
import { DraftsList } from "./DraftsList";
import { DraftDetail } from "./DraftDetail";
import { AudioPanel } from "@/features/audio/components/AudioPanel";
import { AudioPlaybackProvider } from "@/features/audio/contexts/AudioPlaybackContext";
import { VideoWorkspacePanel } from "@/features/video/components/VideoWorkspacePanel";
import { useSessionDrafts } from "../hooks/use-session-drafts";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateSessionDrafts } from "@/shared/lib/query-invalidation";
import { cn } from "@/shared/utils/helpers/utils";
import type { SessionDraft } from "../types/chat.types";
import type { VideoJobResponse } from "@/features/video/types/video.types";

type WorkspaceTab = "drafts" | "audio" | "video";

interface ContentWorkspaceProps {
  sessionId: string;
  activeContentId: number | null;
  streamingContentId: number | null;
  requestAudioForContentId: number | null;
  onActiveContentChange: (id: number) => void;
  onClose: () => void;
  videoJobId: string | null;
  videoJobData: VideoJobResponse | undefined;
  onVideoJobStarted: (jobId: string, contentId: number) => void;
}

export function ContentWorkspace({
  sessionId,
  activeContentId,
  streamingContentId,
  requestAudioForContentId,
  onActiveContentChange,
  onClose,
  videoJobId,
  videoJobData,
  onVideoJobStarted,
}: ContentWorkspaceProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("drafts");
  const [selectedDraft, setSelectedDraft] = useState<SessionDraft | null>(null);

  const { data, isLoading } = useSessionDrafts(sessionId);
  const drafts = data?.drafts ?? [];

  const resolvedVideoDraft =
    selectedDraft ??
    drafts.find((draft) => draft.id === activeContentId) ??
    drafts[drafts.length - 1] ??
    null;

  // Invalidate drafts when stream produces new content
  useEffect(() => {
    if (streamingContentId) {
      void invalidateSessionDrafts(queryClient, sessionId);
    }
  }, [streamingContentId, sessionId, queryClient]);

  // Auto-select newly generated content as active
  useEffect(() => {
    if (streamingContentId) {
      onActiveContentChange(streamingContentId);
    }
  }, [streamingContentId, onActiveContentChange]);

  // Switch to audio tab when requested from parent
  useEffect(() => {
    if (requestAudioForContentId) {
      setActiveTab("audio");
    }
  }, [requestAudioForContentId]);

  // Auto-activate latest draft when none is active
  useEffect(() => {
    if (!isLoading && !activeContentId && drafts.length > 0) {
      onActiveContentChange(drafts[drafts.length - 1].id);
    }
  }, [isLoading, drafts.length, activeContentId, onActiveContentChange]);

  const handleSelectDraft = (draft: SessionDraft) => {
    setSelectedDraft(draft);
  };

  const handleSetActive = (id: number) => {
    onActiveContentChange(id);
  };

  const handleOpenAudio = () => {
    const id =
      selectedDraft?.id ?? activeContentId ?? drafts[drafts.length - 1]?.id;
    if (id) {
      onActiveContentChange(id);
      setActiveTab("audio");
    }
  };

  const handleOpenVideo = () => {
    const id =
      selectedDraft?.id ?? activeContentId ?? drafts[drafts.length - 1]?.id;
    if (id) {
      onActiveContentChange(id);
      setActiveTab("video");
    }
  };

  const handleBack = () => {
    setSelectedDraft(null);
  };

  const draftCount = drafts.length;

  return (
    <div className="w-[380px] h-full border-l bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("drafts")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "drafts"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            {t("workspace_tab_drafts")}
            {draftCount > 0 && (
              <span className="ml-0.5 text-sm text-muted-foreground/70">
                {draftCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "audio"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Mic className="w-3.5 h-3.5" />
            {t("workspace_tab_audio")}
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "video"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Film className="w-3.5 h-3.5" />
            {t("workspace_tab_video")}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
          aria-label={t("workspace_close")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      {activeTab === "drafts" ? (
        isLoading ? (
          <div className="flex-1 flex flex-col gap-2 px-3 py-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-muted/50 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : selectedDraft ? (
          <DraftDetail
            draft={selectedDraft}
            isActive={selectedDraft.id === activeContentId}
            onBack={handleBack}
            onOpenAudio={handleOpenAudio}
            onOpenVideo={handleOpenVideo}
            onSetActive={handleSetActive}
          />
        ) : (
          <DraftsList
            drafts={drafts}
            activeContentId={activeContentId}
            onSelect={handleSelectDraft}
            onSetActive={handleSetActive}
          />
        )
      ) : activeTab === "audio" ? (
        <AudioPlaybackProvider>
          {(activeContentId ?? drafts[drafts.length - 1]?.id) ? (
            <AudioPanel
              generatedContentId={
                activeContentId ?? drafts[drafts.length - 1]!.id
              }
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-base text-muted-foreground px-6 text-center">
              {t("workspace_audio_no_content")}
            </div>
          )}
        </AudioPlaybackProvider>
      ) : resolvedVideoDraft ? (
        <VideoWorkspacePanel
          draft={resolvedVideoDraft}
          onBackToDrafts={() => setActiveTab("drafts")}
          videoJobId={videoJobId}
          onJobStarted={onVideoJobStarted}
          videoJobData={videoJobData}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-base text-muted-foreground px-6 text-center">
          {t("workspace_video_no_content")}
        </div>
      )}
    </div>
  );
}
