import { useTranslation } from "react-i18next";
import type { DragEvent } from "react";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";

export type MediaBinPanelProps = {
  generatedContentId: number;
  onAppendVideoClip: (assetId: string, durationMs: number) => void;
  onInsertVideoClip: (
    assetId: string,
    durationMs: number,
    insertAtIndex: number,
  ) => void;
};

export function MediaBinPanel({
  generatedContentId,
  onAppendVideoClip,
  onInsertVideoClip,
}: MediaBinPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useContentAssets(generatedContentId);
  const assets = data?.assets ?? [];
  const videoAssets = assets.filter((asset) => asset.type === "video_clip");
  const audioAssets = assets.filter((asset) => asset.type === "voiceover" || asset.type === "music");

  const groupedVideoAssets = {
    phase4Shots: videoAssets.filter((asset) => {
      const sourceType = String((asset.metadata?.sourceType as string) ?? "");
      return sourceType.includes("phase4") || sourceType.includes("shot");
    }),
    uploads: videoAssets.filter((asset) => {
      const sourceType = String((asset.metadata?.sourceType as string) ?? "");
      return sourceType.includes("upload");
    }),
    other: videoAssets.filter((asset) => {
      const sourceType = String((asset.metadata?.sourceType as string) ?? "");
      return !sourceType.includes("phase4") && !sourceType.includes("shot") && !sourceType.includes("upload");
    }),
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    assetId: string,
    durationMs: number,
  ) => {
    event.dataTransfer.setData(
      "application/x-contentai-video-asset",
      JSON.stringify({
        assetId,
        durationMs,
      }),
    );
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const renderVideoGroup = (
    title: string,
    groupAssets: typeof videoAssets,
    defaultInsertIndex: number,
  ) => {
    if (!groupAssets.length) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {title}
        </p>
        {groupAssets.slice(0, 12).map((asset) => (
          <div
            key={asset.id}
            className="rounded border border-border/60 bg-muted/20 p-2"
            draggable
            onDragStart={(event) =>
              handleDragStart(event, asset.id, asset.durationMs ?? 2000)
            }
          >
            <p className="truncate text-[11px] text-foreground/85">{asset.id}</p>
            <p className="text-[10px] text-muted-foreground">
              {t("phase5_editor_media_duration", {
                seconds: Math.max(1, Math.floor((asset.durationMs ?? 1000) / 1000)),
              })}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                onClick={() => onAppendVideoClip(asset.id, asset.durationMs ?? 2000)}
                className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
              >
                {t("phase5_editor_media_add_to_timeline")}
              </button>
              <button
                onClick={() =>
                  onInsertVideoClip(
                    asset.id,
                    asset.durationMs ?? 2000,
                    defaultInsertIndex,
                  )
                }
                className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
              >
                {t("phase5_editor_media_insert_to_timeline")}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_media_bin")}
      </p>
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("studio_loading")}</p>
      ) : (
        <>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-medium text-foreground/80">
              {t("phase5_editor_media_video")}
            </p>
            {videoAssets.length > 0 ? (
              <div className="space-y-2">
                {renderVideoGroup(
                  t("phase5_editor_media_group_phase4"),
                  groupedVideoAssets.phase4Shots,
                  0,
                )}
                {renderVideoGroup(
                  t("phase5_editor_media_group_uploads"),
                  groupedVideoAssets.uploads,
                  0,
                )}
                {renderVideoGroup(
                  t("phase5_editor_media_group_other"),
                  groupedVideoAssets.other,
                  0,
                )}
              </div>
            ) : (
              <div className="rounded border border-dashed border-border/60 bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("phase5_editor_media_empty_video")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <a
                    href="/studio/generate"
                    className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
                  >
                    {t("phase5_editor_media_cta_generate")}
                  </a>
                  <a
                    href="/studio"
                    className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
                  >
                    {t("phase5_editor_media_cta_upload")}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-medium text-foreground/80">
              {t("phase5_editor_media_audio")}
            </p>
            {audioAssets.length > 0 ? (
              audioAssets.slice(0, 8).map((asset) => (
                <p key={asset.id} className="truncate text-[11px] text-muted-foreground">
                  {asset.id}
                </p>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("phase5_editor_media_empty_audio")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
