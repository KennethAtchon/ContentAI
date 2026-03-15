import { useState } from "react";
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
}

export function AudioPanel({ generatedContentId }: AudioPanelProps) {
  const [showMusicBrowser, setShowMusicBrowser] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: contentData } = useGeneratedContent(generatedContentId);
  const { data: assetsData, isLoading } = useContentAssets(generatedContentId);

  const cleanScriptForAudio = contentData?.content.cleanScriptForAudio ?? null;
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
        previewUrl: musicAsset.audioUrl ?? "",
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
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-24 bg-muted rounded-xl animate-pulse" />
            <div className="h-8 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <>
            {showGenerator ? (
              <VoiceoverGenerator
                generatedContentId={generatedContentId}
                generatedScript={cleanScriptForAudio}
                generatedHook={generatedHook}
                onSuccess={(url) => {
                  setLocalAudioUrl(url);
                  setIsRegenerating(false);
                }}
                onCancel={isRegenerating ? () => setIsRegenerating(false) : undefined}
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

            <div className="h-px bg-border" />

            <MusicAttachment
              currentTrack={currentMusicTrack}
              onBrowse={() => setShowMusicBrowser(true)}
              onRemove={() => void handleRemoveMusic()}
            />

            {hasVoiceover && hasMusic && (
              <>
                <div className="h-px bg-border" />
                <VolumeBalance
                value={volumeBalance}
                onChange={handleVolumeChange}
                isSaving={updateMetadata.isPending}
                voiceoverUrl={audioUrl ?? undefined}
                musicUrl={currentMusicTrack?.previewUrl || undefined}
              />
              </>
            )}
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
