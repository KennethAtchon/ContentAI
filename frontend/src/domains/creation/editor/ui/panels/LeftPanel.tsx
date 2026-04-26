import { Image, Music, Search, Sparkles, Video } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Clip, TrackType } from "../../model/editor-domain";

export type TabKey = "media" | "audio" | "generate";

interface LeftPanelProps {
  generatedContentId?: number | null;
  getCurrentTimeMs?: () => number;
  onAddClip?: (trackId: string, clip: Clip) => void;
  readOnly?: boolean;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  pendingAdd?: { trackId: string; startMs: number } | null;
  onClearPendingAdd?: () => void;
}

const tabs: { key: TabKey; label: string; icon: typeof Video }[] = [
  { key: "media", label: "Media", icon: Video },
  { key: "audio", label: "Audio", icon: Music },
  { key: "generate", label: "Generate", icon: Sparkles },
];

const sampleAssets = [
  {
    id: "asset-1",
    label: "Opening shot",
    type: "video" as TrackType,
    icon: Video,
  },
  {
    id: "asset-2",
    label: "Product still",
    type: "video" as TrackType,
    icon: Image,
  },
  {
    id: "asset-3",
    label: "Narration",
    type: "audio" as TrackType,
    icon: Music,
  },
];

export const LeftPanel = memo(function LeftPanel({
  activeTab: controlledTab,
  onTabChange,
}: LeftPanelProps) {
  const { t } = useTranslation();
  const [localTab, setLocalTab] = useState<TabKey>("media");
  const [search, setSearch] = useState("");
  const activeTab = controlledTab ?? localTab;

  const setActiveTab = (tab: TabKey) => {
    setLocalTab(tab);
    onTabChange?.(tab);
  };

  const visibleAssets = sampleAssets.filter((asset) =>
    asset.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className="flex flex-col min-h-0 border-r border-overlay-sm bg-studio-surface"
      style={{ width: 300 }}
    >
      <div className="flex border-b border-overlay-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border-0 bg-transparent",
                activeTab === tab.key ? "text-studio-accent" : "text-dim-3",
              ].join(" ")}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-b border-overlay-sm">
        <div className="flex items-center gap-2 rounded-md border border-overlay-sm bg-overlay-sm px-2">
          <Search size={13} className="text-dim-3" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common_search") ?? "Search"}
            className="h-8 min-w-0 flex-1 bg-transparent text-xs text-dim-1 outline-none placeholder:text-dim-4"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {visibleAssets.map((asset) => {
          const Icon = asset.icon;
          return (
            <button
              key={asset.id}
              type="button"
              className="w-full flex items-center gap-3 rounded-md border border-overlay-sm bg-overlay-sm px-3 py-2 text-left hover:bg-overlay-md transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded bg-studio-bg text-dim-2">
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-dim-1">
                  {asset.label}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-dim-4">
                  {asset.type}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
});
