import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Music, Mic } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useMediaLibrary } from "@/features/media/hooks/use-media-library";
import { MediaUploadZone } from "@/features/media/components/MediaUploadZone";
import type { Clip } from "../types/editor";

interface Asset {
  id: string;
  type: string;
  r2Url?: string;
  mediaUrl?: string;
  audioUrl?: string;
  durationMs: number | null;
  metadata?: Record<string, unknown>;
}

interface Props {
  generatedContentId: number | null;
  currentTimeMs: number;
  onAddClip: (trackId: string, clip: Clip) => void;
}

type TabKey = "media" | "effects" | "audio" | "text";

const EFFECTS = [
  { id: "color-grade", label: "Color Grade", contrast: 20, warmth: 10 },
  { id: "bw", label: "B&W", contrast: 10, warmth: -100 },
  { id: "warm", label: "Warm", warmth: 40, contrast: 5 },
  { id: "cool", label: "Cool", warmth: -40, contrast: 5 },
  { id: "vignette", label: "Vignette", opacity: 0.9, contrast: 15 },
];

const TEXT_PRESETS = [
  {
    id: "title",
    label: "Title",
    content: "Title Text",
    fontSize: 64,
    fontWeight: "bold",
  },
  {
    id: "subtitle",
    label: "Subtitle",
    content: "Subtitle",
    fontSize: 40,
    fontWeight: "normal",
  },
  {
    id: "caption",
    label: "Caption",
    content: "Caption here",
    fontSize: 28,
    fontWeight: "normal",
  },
];

function makeClip(overrides: Partial<Clip>): Clip {
  return {
    id: crypto.randomUUID(),
    assetId: null,
    label: "Clip",
    startMs: 0,
    durationMs: 5000,
    trimStartMs: 0,
    trimEndMs: 0,
    speed: 1,
    opacity: 1,
    warmth: 0,
    contrast: 0,
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    volume: 1,
    muted: false,
    ...overrides,
  };
}

export function MediaPanel({
  generatedContentId,
  currentTimeMs,
  onAddClip,
}: Props) {
  const { t } = useTranslation();
  const fetcher = useQueryFetcher<{ assets: Asset[] }>();
  const [activeTab, setActiveTab] = useState<TabKey>("media");
  const [search, setSearch] = useState("");

  const { data: assetsData } = useQuery({
    queryKey: queryKeys.api.contentAssets(generatedContentId ?? 0),
    queryFn: () =>
      fetcher(`/api/assets?generatedContentId=${generatedContentId}`),
    enabled: !!generatedContentId,
  });

  const { data: libraryData } = useMediaLibrary();

  const allAssets = assetsData?.assets ?? [];
  const videoAssets = allAssets.filter(
    (a) => a.type === "video_clip" || a.type === "assembled_video"
  );
  const audioAssets = allAssets.filter(
    (a) => a.type === "voiceover" || a.type === "music"
  );
  const libraryVideoItems = (libraryData?.items ?? []).filter(
    (item) => item.type === "video"
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "media", label: t("editor_media_tab") },
    { key: "effects", label: t("editor_effects_tab") },
    { key: "audio", label: t("editor_audio_tab") },
    { key: "text", label: t("editor_text_tab") },
  ];

  const addVideoClip = (asset: Asset) => {
    const clip = makeClip({
      assetId: asset.id,
      label: String(asset.metadata?.originalName ?? asset.type),
      startMs: currentTimeMs,
      durationMs: asset.durationMs ?? 5000,
    });
    onAddClip("video", clip);
  };

  const addAudioClip = (asset: Asset) => {
    const trackId = asset.type === "music" ? "music" : "audio";
    const clip = makeClip({
      assetId: asset.id,
      label: String(asset.metadata?.originalName ?? asset.type),
      startMs: currentTimeMs,
      durationMs: asset.durationMs ?? 30000,
    });
    onAddClip(trackId, clip);
  };

  const applyEffect = (_effect: (typeof EFFECTS)[0]) => {
    // Effects are shown for reference; apply via Inspector on selected clip
  };

  const addTextClip = (preset: (typeof TEXT_PRESETS)[0]) => {
    const clip = makeClip({
      assetId: null,
      label: preset.label,
      startMs: currentTimeMs,
      durationMs: 3000,
      textContent: preset.content,
      textStyle: {
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight as "bold" | "normal",
        color: "#ffffff",
        align: "center",
      },
    });
    onAddClip("text", clip);
  };

  return (
    <div
      className="flex flex-col h-full border-r border-overlay-sm bg-studio-surface"
      style={{ width: 220 }}
    >
      {/* Tabs */}
      <div className="flex border-b border-overlay-sm shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-2 text-[11px] font-medium border-0 cursor-pointer transition-colors bg-transparent border-b-2",
              activeTab === tab.key
                ? "text-studio-accent border-b-studio-accent"
                : "text-dim-3 border-b-transparent hover:text-dim-1"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (media + audio only) */}
      {(activeTab === "media" || activeTab === "audio") && (
        <div className="px-2 py-2 border-b border-overlay-sm shrink-0">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-overlay-sm text-dim-1 px-2.5 py-1.5 rounded-full border-0 outline-none"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Media tab */}
        {activeTab === "media" && (
          <>
            {videoAssets.length === 0 && (
              <p className="text-xs italic text-dim-3 text-center mt-4">
                {generatedContentId
                  ? "No video assets found"
                  : "Select a queue item to load assets"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {videoAssets
                .filter(
                  (a) =>
                    !search ||
                    String(a.metadata?.originalName ?? a.type)
                      .toLowerCase()
                      .includes(search.toLowerCase())
                )
                .map((asset) => (
                  <button
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-contentai-asset",
                        JSON.stringify({
                          assetId: asset.id,
                          type: asset.type,
                          durationMs: asset.durationMs,
                          label: String(asset.metadata?.originalName ?? asset.type),
                        }),
                      );
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => addVideoClip(asset)}
                    className="group relative aspect-video rounded overflow-hidden bg-overlay-sm border border-overlay-sm hover:border-studio-accent/50 transition-colors cursor-pointer"
                    title="Click or drag to timeline"
                  >
                    {/* Film sprocket decoration */}
                    <div className="absolute left-0 top-0 h-full w-1.5 bg-repeating-sprocket opacity-60 z-10" />
                    <div className="absolute right-0 top-0 h-full w-1.5 bg-repeating-sprocket opacity-60 z-10" />

                    <video
                      src={asset.mediaUrl ?? undefined}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                      <span className="text-[9px] text-white/80 truncate block">
                        {String(asset.metadata?.originalName ?? asset.type)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            {/* My Library section */}
            <div className="mt-3 border-t border-overlay-sm pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-dim-3 uppercase tracking-wider">
                  {t("editor_media_library_section")}
                </span>
                <MediaUploadZone compact />
              </div>

              {libraryVideoItems.length === 0 ? (
                <p className="text-xs italic text-dim-3 text-center mt-2">
                  {t("media_library_empty")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {libraryVideoItems
                    .filter(
                      (item) =>
                        !search ||
                        item.name
                          .toLowerCase()
                          .includes(search.toLowerCase())
                    )
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() =>
                          addVideoClip({
                            id: item.id,
                            type: "video_clip",
                            mediaUrl: item.mediaUrl,
                            durationMs: item.durationMs,
                            metadata: { originalName: item.name },
                          })
                        }
                        className="group relative aspect-video rounded overflow-hidden bg-overlay-sm border border-overlay-sm hover:border-studio-accent/50 transition-colors cursor-pointer"
                        title="Click to add to timeline"
                      >
                        <video
                          src={item.mediaUrl ?? undefined}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                          <span className="text-[9px] text-white/80 truncate block">
                            {item.name}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Effects tab */}
        {activeTab === "effects" && (
          <div className="flex flex-col gap-1.5">
            {EFFECTS.map((effect) => (
              <button
                key={effect.id}
                onClick={() => applyEffect(effect)}
                className="text-left px-3 py-2 rounded bg-overlay-sm hover:bg-overlay-md border-0 cursor-pointer transition-colors"
              >
                <p className="text-xs font-medium text-dim-1">{effect.label}</p>
                <p className="text-[10px] text-dim-3 mt-0.5">
                  {Object.entries(effect)
                    .filter(([k]) => k !== "id" && k !== "label")
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Audio tab */}
        {activeTab === "audio" && (
          <>
            {audioAssets.length === 0 && (
              <p className="text-xs italic text-dim-3 text-center mt-4">
                No audio assets
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {audioAssets
                .filter(
                  (a) =>
                    !search ||
                    String(a.metadata?.originalName ?? a.type)
                      .toLowerCase()
                      .includes(search.toLowerCase())
                )
                .map((asset) => (
                  <button
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-contentai-asset",
                        JSON.stringify({
                          assetId: asset.id,
                          type: asset.type,
                          durationMs: asset.durationMs,
                          label: String(asset.metadata?.originalName ?? asset.type),
                        }),
                      );
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => addAudioClip(asset)}
                    className="flex items-center gap-2 px-3 py-2 rounded bg-overlay-sm hover:bg-overlay-md border-0 cursor-pointer transition-colors text-left"
                  >
                    <span className="text-dim-3 shrink-0">
                      {asset.type === "music" ? <Music size={14} /> : <Mic size={14} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-dim-1 truncate">
                        {String(asset.metadata?.originalName ?? asset.type)}
                      </p>
                      {asset.durationMs && (
                        <p className="text-[10px] text-dim-3">
                          {(asset.durationMs / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}

        {/* Text tab */}
        {activeTab === "text" && (
          <div className="flex flex-col gap-1.5">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => addTextClip(preset)}
                className="text-left px-3 py-3 rounded bg-overlay-sm hover:bg-overlay-md border-0 cursor-pointer transition-colors"
              >
                <p
                  className="text-dim-1 truncate"
                  style={{
                    fontSize: Math.min(preset.fontSize / 3, 18),
                    fontWeight: preset.fontWeight,
                  }}
                >
                  {preset.label}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
