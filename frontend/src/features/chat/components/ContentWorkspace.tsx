import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, FileText, Mic, Film } from "lucide-react";
import { DraftsList } from "./DraftsList";
import { DraftDetail } from "./DraftDetail";
import { AudioPanel } from "@/features/audio/components/AudioPanel";
import { AudioPlaybackProvider } from "@/features/audio/contexts/AudioPlaybackContext";
import { VideoWorkspacePanel } from "@/features/video/components/VideoWorkspacePanel";
import { useSessionDrafts } from "../hooks/use-session-drafts";
import { cn } from "@/shared/utils/helpers/utils";
import type { SessionDraft } from "../types/chat.types";
import type { VideoJobResponse } from "@/features/video/types/video.types";

type WorkspaceTab = "drafts" | "audio" | "video";

interface ContentWorkspaceProps {
  sessionId: string;
  activeContentId: number | null;
  persistedActiveContentId: number | null;
  latestStreamingContentId: number | null;
  onActiveContentChange: (id: number) => void;
  onClose: () => void;
  videoJobId: string | null;
  videoJobData: VideoJobResponse | undefined;
  onVideoJobStarted: (jobId: string, contentId: number) => void;
}

export function ContentWorkspace({
  sessionId,
  activeContentId,
  persistedActiveContentId,
  latestStreamingContentId,
  onActiveContentChange,
  onClose,
  videoJobId,
  videoJobData,
  onVideoJobStarted,
}: ContentWorkspaceProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("drafts");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);

  const { data, isLoading } = useSessionDrafts(sessionId);
  const drafts = data?.drafts ?? [];
  const selectedDraft =
    drafts.find((draft) => draft.id === selectedDraftId) ?? null;

  const resolvedVideoDraft =
    selectedDraft ??
    drafts.find((draft) => draft.id === activeContentId) ??
    drafts[drafts.length - 1] ??
    null;

  useEffect(() => {
    // Keep detail views derived from the latest query result so the open draft
    // does not drift stale after refetches or streamed updates.
    if (selectedDraftId != null && !selectedDraft) {
      setSelectedDraftId(null);
    }
  }, [selectedDraftId, selectedDraft]);

  useEffect(() => {
    if (
      latestStreamingContentId != null &&
      drafts.some((draft) => draft.id === latestStreamingContentId)
    ) {
      setSelectedDraftId(null);
    }
  }, [latestStreamingContentId, drafts]);

  // Auto-activate latest draft when none is active
  useEffect(() => {
    if (
      !isLoading &&
      persistedActiveContentId == null &&
      activeContentId == null &&
      drafts.length > 0
    ) {
      onActiveContentChange(drafts[drafts.length - 1].id);
    }
  }, [
    isLoading,
    drafts,
    persistedActiveContentId,
    activeContentId,
    onActiveContentChange,
  ]);

  const handleSelectDraft = (draft: SessionDraft) => {
    // In this workspace, opening a draft means the user wants the AI to keep
    // iterating on that draft next, so selection and activation move together.
    setSelectedDraftId(draft.id);
    onActiveContentChange(draft.id);
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
    setSelectedDraftId(null);
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
          />
        ) : (
          <DraftsList
            drafts={drafts}
            activeContentId={activeContentId}
            onSelect={handleSelectDraft}
          />
        )
      ) : activeTab === "audio" ? (
        <AudioPlaybackProvider>
          {isLoading ? (
            <div className="flex-1 flex flex-col gap-2 px-3 py-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-muted/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (activeContentId ?? drafts[drafts.length - 1]?.id) ? (
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
      ) : isLoading ? (
        <div className="flex-1 flex flex-col gap-2 px-3 py-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-muted/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
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
