import { useTranslation } from "react-i18next";
import type { DragEvent } from "react";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";

export type MediaBinPanelProps = {
  generatedContentId: number;
  onAppendVideoClip: (assetId: string, durationMs: number) => void;
  onInsertVideoClip: (assetId: string, durationMs: number, insertAtIndex: number) => void;
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
  const audioAssets = assets.filter(
    (asset) => asset.type === "voiceover" || asset.type === "music",
  );

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
      return (
        !sourceType.includes("phase4") &&
        !sourceType.includes("shot") &&
        !sourceType.includes("upload")
      );
    }),
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    assetId: string,
    durationMs: number,
  ) => {
    event.dataTransfer.setData(
      "application/x-contentai-video-asset",
      JSON.stringify({ assetId, durationMs }),
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
      <div className="space-y-px">
        <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-dim-3">
          {title}
        </p>
        {groupAssets.slice(0, 12).map((asset) => (
          <div
            key={asset.id}
            className="group flex items-center gap-2 px-3 py-2 cursor-grab hover:bg-overlay-xs transition-colors border-l-2 border-transparent hover:border-blue-400/40"
            draggable
            onDragStart={(event) =>
              handleDragStart(event, asset.id, asset.durationMs ?? 2000)
            }
          >
            {/* Thumbnail placeholder */}
            <div className="w-9 h-6 rounded bg-blue-500/15 border border-overlay-md shrink-0 flex items-center justify-center">
              <span className="text-[8px] text-blue-300/40">▶</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-[10px] text-dim-1 font-medium leading-tight">
                {asset.id.slice(-8)}
              </p>
              <p className="text-[9px] text-dim-3">
                {t("phase5_editor_media_duration", {
                  seconds: Math.max(1, Math.floor((asset.durationMs ?? 1000) / 1000)),
                })}
              </p>
            </div>

            {/* Action buttons — revealed on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onAppendVideoClip(asset.id, asset.durationMs ?? 2000)}
                className="px-1.5 py-0.5 rounded text-[8px] font-semibold text-blue-300/70 hover:text-blue-200 hover:bg-blue-500/20 transition-colors"
                title={t("phase5_editor_media_add_to_timeline")}
              >
                +
              </button>
              <button
                onClick={() =>
                  onInsertVideoClip(asset.id, asset.durationMs ?? 2000, defaultInsertIndex)
                }
                className="px-1.5 py-0.5 rounded text-[8px] font-semibold text-dim-2 hover:text-dim-1 hover:bg-overlay-sm transition-colors"
                title={t("phase5_editor_media_insert_to_timeline")}
              >
                ↤
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    // No outer border box — the left column border in EditorShell provides the separation
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-3 py-2.5 border-b border-overlay-sm shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dim-3">
          {t("phase5_editor_media_bin")}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="px-3 py-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded bg-overlay-xs animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Video section */}
          <div className="py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold text-dim-2">
              {t("phase5_editor_media_video")}
            </p>
            {videoAssets.length > 0 ? (
              <div>
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
              <div className="px-3 py-4 space-y-2">
                <p className="text-[10px] text-dim-3">
                  {t("phase5_editor_media_empty_video")}
                </p>
                <div className="flex flex-col gap-1.5">
                  <a
                    href="/studio/generate"
                    className="text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors"
                  >
                    → {t("phase5_editor_media_cta_generate")}
                  </a>
                  <a
                    href="/studio"
                    className="text-[10px] text-dim-2 hover:text-dim-1 transition-colors"
                  >
                    → {t("phase5_editor_media_cta_upload")}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-overlay-sm mx-3 my-1" />

          {/* Audio section */}
          <div className="py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold text-dim-2">
              {t("phase5_editor_media_audio")}
            </p>
            {audioAssets.length > 0 ? (
              audioAssets.slice(0, 8).map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-overlay-xs transition-colors"
                >
                  <div className="w-9 h-6 rounded bg-purple-500/15 border border-overlay-md shrink-0 flex items-center justify-center">
                    <span className="text-[8px] text-purple-300/40">♫</span>
                  </div>
                  <p className="truncate text-[10px] text-dim-2">{asset.id.slice(-8)}</p>
                </div>
              ))
            ) : (
              <p className="px-3 py-2 text-[10px] text-dim-3">
                {t("phase5_editor_media_empty_audio")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
