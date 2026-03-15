import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2 } from "lucide-react";
import { VoiceoverGenerator } from "./VoiceoverGenerator";
import { VoiceoverPlayer } from "./VoiceoverPlayer";
import { MusicLibraryBrowser } from "./MusicLibraryBrowser";
import { MusicAttachment } from "./MusicAttachment";
import { VolumeBalance } from "./VolumeBalance";
import { useContentAssets } from "../hooks/use-content-assets";
import { useGeneratedContent } from "../hooks/use-generated-content";
import { useAttachMusic } from "../hooks/use-attach-music";
import { useDeleteAsset } from "../hooks/use-delete-asset";
import { useUpdateAssetMetadata } from "../hooks/use-update-asset-metadata";
import type { MusicTrack } from "../types/audio.types";

interface AudioPanelProps {
  generatedContentId: number;
  onClose: () => void;
}

export function AudioPanel({
  generatedContentId,
  onClose,
}: AudioPanelProps) {
  const { t } = useTranslation();
  const [showMusicBrowser, setShowMusicBrowser] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: contentData } = useGeneratedContent(generatedContentId);
  const { data: assetsData, isLoading } = useContentAssets(generatedContentId);

  const generatedScript = contentData?.content.generatedScript ?? null;
  const generatedHook = contentData?.content.generatedHook ?? null;
  const attachMusic = useAttachMusic();
  const deleteAsset = useDeleteAsset(generatedContentId);
  const updateMetadata = useUpdateAssetMetadata(generatedContentId);

  const assets = assetsData?.assets ?? [];
  const voiceoverAsset = assets.find((a) => a.type === "voiceover");
  const musicAsset = assets.find((a) => a.type === "music");

  const audioUrl = localAudioUrl ?? voiceoverAsset?.audioUrl ?? null;
  const hasVoiceover = !!voiceoverAsset;
  const hasMusic = !!musicAsset;
  const isReady = hasVoiceover && hasMusic;

  // Build a minimal MusicTrack from stored asset metadata for display
  const currentMusicTrack: MusicTrack | null = musicAsset
    ? {
        id: String(
          (musicAsset.metadata as Record<string, unknown>)?.musicTrackId ?? ""
        ),
        name: String(
          (musicAsset.metadata as Record<string, unknown>)?.trackName ?? ""
        ),
        artistName:
          ((musicAsset.metadata as Record<string, unknown>)
            ?.artistName as string) ?? null,
        durationSeconds: musicAsset.durationMs
          ? musicAsset.durationMs / 1000
          : 0,
        mood: String(
          (musicAsset.metadata as Record<string, unknown>)?.mood ?? ""
        ),
        previewUrl: "",
        isSystemTrack: true,
      }
    : null;

  const volumeBalance = Number(
    (voiceoverAsset?.metadata as Record<string, unknown>)?.volumeBalance ?? 70
  );

  const handleVolumeChange = (value: number) => {
    if (!voiceoverAsset) return;
    updateMetadata.mutate({
      assetId: voiceoverAsset.id,
      metadata: { volumeBalance: value },
    });
  };

  const handleAttachMusic = async (track: MusicTrack) => {
    await attachMusic.mutateAsync({
      generatedContentId,
      musicTrackId: track.id,
    });
  };

  const handleRemoveMusic = async () => {
    if (!musicAsset) return;
    await deleteAsset.mutateAsync(musicAsset.id);
  };

  const handleRegenerate = () => {
    setLocalAudioUrl(null);
    setIsRegenerating(true);
  };

  const showGenerator = !hasVoiceover || isRegenerating;

  return (
    <div className="w-[380px] h-full border-l bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t("audio_panel_title")}</h3>
          {isReady && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">
                {t("audio_panel_ready")}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label={t("audio_panel_close")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-24 bg-muted rounded-xl animate-pulse" />
            <div className="h-8 bg-muted rounded animate-pulse" />
          </div>
        ) : showGenerator ? (
          <VoiceoverGenerator
            generatedContentId={generatedContentId}
            generatedScript={generatedScript}
            generatedHook={generatedHook}
            onSuccess={(url) => {
              setLocalAudioUrl(url);
              setIsRegenerating(false);
            }}
          />
        ) : (
          voiceoverAsset &&
          audioUrl && (
            <VoiceoverPlayer
              asset={voiceoverAsset}
              audioUrl={audioUrl}
              onRegenerate={handleRegenerate}
            />
          )
        )}

        {!showGenerator && (
          <>
            <div className="h-px bg-border" />

            {hasVoiceover && hasMusic && (
              <>
                <VolumeBalance
                  value={volumeBalance}
                  onChange={handleVolumeChange}
                  isSaving={updateMetadata.isPending}
                />
                <div className="h-px bg-border" />
              </>
            )}

            <MusicAttachment
              hasVoiceover={hasVoiceover}
              currentTrack={currentMusicTrack}
              onBrowse={() => setShowMusicBrowser(true)}
              onRemove={() => void handleRemoveMusic()}
            />
          </>
        )}
      </div>

      <MusicLibraryBrowser
        open={showMusicBrowser}
        onOpenChange={setShowMusicBrowser}
        onSelectTrack={(track) => void handleAttachMusic(track)}
        currentTrackId={currentMusicTrack?.id}
      />
    </div>
  );
}
