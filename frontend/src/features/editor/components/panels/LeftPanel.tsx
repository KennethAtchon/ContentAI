import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Film,
  Mic,
  Sparkles,
  Music,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/shared/utils/helpers/utils";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useMediaLibrary } from "@/features/media/hooks/use-media-library";
import { MediaUploadZone } from "@/features/media/components/MediaUploadZone";
import type { AudioClip, CaptionClip, Clip, MusicClip, VideoClip } from "../../types/editor";
import { useEditorDocumentContext } from "../../context/EditorDocumentContext";
import { isMediaClip } from "../../utils/clip-types";

interface Asset {
  id: string;
  type: string;
  r2Url?: string;
  mediaUrl?: string;
  audioUrl?: string;
  durationMs: number | null;
  metadata?: Record<string, unknown>;
}

export type TabKey = "media" | "audio" | "generate";

interface LeftPanelProps {
  generatedContentId: number | null;
  getCurrentTimeMs: () => number;
  onAddClip: (trackId: string, clip: VideoClip | AudioClip | MusicClip) => void;
  readOnly?: boolean;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pendingAdd: { trackId: string; startMs: number } | null;
  onClearPendingAdd: () => void;
}

const TABS: {
  key: TabKey;
  icon: LucideIcon;
  labelKey: string;
}[] = [
  { key: "media", icon: Film, labelKey: "editor_media_tab" },
  { key: "audio", icon: Mic, labelKey: "editor_audio_tab" },
  { key: "generate", icon: Sparkles, labelKey: "editor_generate_tab" },
];

function makeVideoClip(overrides: Partial<VideoClip>): VideoClip {
  return {
    id: crypto.randomUUID(),
    locallyModified: false,
    type: "video",
    assetId: null,
    label: "Clip",
    startMs: 0,
    durationMs: 5000,
    trimStartMs: 0,
    trimEndMs: 0,
    speed: 1,
    enabled: true,
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

function makeAudioClip(
  type: "audio" | "music",
  overrides: Partial<AudioClip | MusicClip>
): AudioClip | MusicClip {
  return {
    id: crypto.randomUUID(),
    locallyModified: false,
    type,
    assetId: null,
    label: "Clip",
    startMs: 0,
    durationMs: 5000,
    trimStartMs: 0,
    trimEndMs: 0,
    speed: 1,
    enabled: true,
    opacity: 1,
    warmth: 0,
    contrast: 0,
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    volume: type === "music" ? 0.3 : 1,
    muted: false,
    ...overrides,
  };
}

function SortableShotCard({
  clip,
  index,
  readOnly,
}: {
  clip: Exclude<Clip, CaptionClip>;
  index: number;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id, disabled: readOnly });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded border border-overlay-sm bg-studio-bg px-2 py-1.5 select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-dim-3 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={12} />
      </span>
      <span className="text-[9px] font-mono text-dim-3 w-4 shrink-0 text-right">{index}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-dim-1 truncate">{clip.label}</p>
        <p className="text-[9px] text-dim-3">{(clip.durationMs / 1000).toFixed(1)}s</p>
      </div>
    </div>
  );
}

export const LeftPanel = memo(function LeftPanel({
  generatedContentId,
  getCurrentTimeMs,
  onAddClip,
  readOnly,
  activeTab,
  onTabChange,
  pendingAdd,
  onClearPendingAdd,
}: LeftPanelProps) {
  const { t } = useTranslation();
  const { tracks, reorderShots } = useEditorDocumentContext();
  const fetcher = useQueryFetcher<{ assets: Asset[] }>();
  const [search, setSearch] = useState("");
  const [showShotOrder, setShowShotOrder] = useState(false);

  const { data: assetsData } = useQuery({
    queryKey: queryKeys.api.contentAssets(generatedContentId ?? 0),
    queryFn: () => fetcher(`/api/assets?generatedContentId=${generatedContentId}`),
    enabled: !!generatedContentId,
  });
  const { data: libraryData } = useMediaLibrary();

  const allAssets = assetsData?.assets ?? [];
  const videoAssets = allAssets.filter((a) => a.type === "video_clip");
  const audioAssets = allAssets.filter((a) => a.type === "voiceover" || a.type === "music");
  const libraryVideoItems = (libraryData?.items ?? []).filter((item) => item.type === "video");

  const videoTrack = tracks.find((tr) => tr.type === "video");
  const sortedClips = videoTrack
    ? [...videoTrack.clips].filter(isMediaClip).sort((a, b) => a.startMs - b.startMs)
    : [];
  const clipIds = sortedClips.map((c) => c.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleShotDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !videoTrack) return;
    const oldIndex = clipIds.indexOf(active.id as string);
    const newIndex = clipIds.indexOf(over.id as string);
    reorderShots(videoTrack.id, arrayMove(clipIds, oldIndex, newIndex));
  }

  const addVideoClip = (asset: Asset) => {
    const clip = makeVideoClip({
      assetId: asset.id,
      label: String(asset.metadata?.originalName ?? asset.type),
      startMs: pendingAdd?.startMs ?? getCurrentTimeMs(),
      durationMs: asset.durationMs ?? 5000,
      sourceMaxDurationMs: asset.durationMs ?? undefined,
    });
    onAddClip(pendingAdd?.trackId ?? "video", clip);
    onClearPendingAdd();
  };

  const addAudioClip = (asset: Asset) => {
    const defaultTrackId = asset.type === "music" ? "music" : "audio";
    const clip = makeAudioClip(defaultTrackId, {
      assetId: asset.id,
      label: String(asset.metadata?.originalName ?? asset.type),
      startMs: pendingAdd?.startMs ?? getCurrentTimeMs(),
      durationMs: asset.durationMs ?? 30000,
      sourceMaxDurationMs: asset.durationMs ?? undefined,
    });
    onAddClip(pendingAdd?.trackId ?? defaultTrackId, clip);
    onClearPendingAdd();
  };

  const visibleTabs = TABS.filter(
    (tab) => tab.key !== "generate" || !!generatedContentId
  );

  return (
    <div className="flex min-h-0 shrink-0 h-full border-r border-overlay-sm">
      {/* Icon rail */}
      <div className="flex flex-col items-center py-2 gap-1 bg-studio-surface border-r border-overlay-sm shrink-0" style={{ width: 56 }}>
        {visibleTabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            title={t(labelKey)}
            onClick={() => onTabChange(key)}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer border-0 transition-colors",
              activeTab === key
                ? "bg-studio-accent/20 text-studio-accent"
                : "text-dim-3 hover:text-dim-1 hover:bg-overlay-sm"
            )}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      {/* Content column */}
      <div className="flex flex-col min-h-0 bg-studio-surface" style={{ width: 244 }}>
        {/* Pending add banner */}
        {pendingAdd !== null && (
          <div className="px-3 py-1.5 bg-studio-accent/10 border-b border-studio-accent/30 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-studio-accent font-medium">
              Placing at {(pendingAdd.startMs / 1000).toFixed(1)}s
            </span>
            <button
              onClick={onClearPendingAdd}
              className="text-studio-accent/60 hover:text-studio-accent text-[10px] border-0 bg-transparent cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Column header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-overlay-sm shrink-0">
          <span className="text-xs font-semibold text-dim-2">
            {t(visibleTabs.find((tab) => tab.key === activeTab)?.labelKey ?? "editor_media_tab")}
          </span>
          {activeTab === "media" && (
            <button
              type="button"
              onClick={() => setShowShotOrder(!showShotOrder)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer",
                showShotOrder
                  ? "bg-studio-accent/20 border-studio-accent/60 text-studio-accent"
                  : "bg-transparent border-overlay-md text-dim-3 hover:text-dim-1"
              )}
            >
              {t("editor_shots_label")}
            </button>
          )}
        </div>

        {/* Search */}
        {(activeTab === "media" || activeTab === "audio") && !showShotOrder && (
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
          {/* Shot order view */}
          {activeTab === "media" && showShotOrder && (
            <>
              {sortedClips.length === 0 ? (
                <p className="text-xs italic text-dim-3 text-center mt-4">{t("editor_shots_empty")}</p>
              ) : (
                <>
                  {!readOnly && (
                    <p className="text-[10px] text-dim-3 mb-2">{t("editor_shots_reorder_hint")}</p>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleShotDragEnd}
                  >
                    <SortableContext items={clipIds} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-1">
                        {sortedClips.map((clip, i) => (
                          <SortableShotCard
                            key={clip.id}
                            clip={clip}
                            index={i + 1}
                            readOnly={readOnly}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </>
          )}

          {/* Media tab */}
          {activeTab === "media" && !showShotOrder && (
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
                          })
                        );
                        e.dataTransfer.setData(
                          `application/x-contentai-type-${asset.type}`,
                          "1"
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addVideoClip(asset)}
                      className="group relative aspect-video rounded overflow-hidden bg-overlay-sm border border-overlay-sm hover:border-studio-accent/50 transition-colors cursor-pointer"
                      title="Click or drag to timeline"
                    >
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

              {/* My Library */}
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
                          item.name.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "application/x-contentai-asset",
                              JSON.stringify({
                                assetId: item.id,
                                type: "video_clip",
                                durationMs: item.durationMs,
                                label: item.name,
                              })
                            );
                            e.dataTransfer.setData(
                              "application/x-contentai-type-video_clip",
                              "1"
                            );
                            e.dataTransfer.effectAllowed = "copy";
                          }}
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
                          title="Click or drag to timeline"
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

          {/* Audio tab */}
          {activeTab === "audio" && (
            <>
              {audioAssets.length === 0 && (
                <p className="text-xs italic text-dim-3 text-center mt-4">
                  {t("editor_audio_empty")}
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
                          })
                        );
                        e.dataTransfer.setData(
                          `application/x-contentai-type-${asset.type}`,
                          "1"
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addAudioClip(asset)}
                      className="flex items-center gap-2 px-3 py-2 rounded bg-overlay-sm hover:bg-overlay-md border-0 cursor-pointer transition-colors text-left"
                    >
                      <span className="text-dim-3 shrink-0">
                        {asset.type === "music" ? (
                          <Music size={14} />
                        ) : (
                          <Mic size={14} />
                        )}
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

          {/* Generate tab */}
          {activeTab === "generate" && (
            <div className="flex flex-col items-center gap-3 p-4 pt-6">
              <p className="text-xs italic text-dim-3 text-center">
                {t("editor_generate_up_to_date")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

LeftPanel.displayName = "LeftPanel";
