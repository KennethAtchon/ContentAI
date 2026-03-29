import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { X, Loader2, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import type { VersionGroup } from "./queue.types";
import { STATUS_STYLES, STAGE_DOT } from "./queue.types";

export function StackedQueueCard({
  group,
  selectedItemId,
  onSelectItem,
  onDelete,
  onDuplicate,
  deletingId,
  duplicatingId,
}: {
  group: VersionGroup;
  selectedItemId: number | null;
  onSelectItem: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  deletingId: number | null;
  duplicatingId: number | null;
}) {
  const { t } = useTranslation();
  const sortedItems = group.items;
  const [activeIdx, setActiveIdx] = useState(sortedItems.length - 1);
  const item = sortedItems[activeIdx];
  const isSelected = selectedItemId === item.id;

  const canGoLeft = activeIdx > 0;
  const canGoRight = activeIdx < sortedItems.length - 1;

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 85) +
      (item.generatedHook.length > 85 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter(
    (s) => s.status === "running"
  );

  return (
    <div
      onClick={() => onSelectItem(item.id)}
      className={cn(
        "group relative rounded-xl px-3 pt-2.5 pb-1.5 cursor-pointer transition-all duration-150 border",
        isSelected
          ? "bg-studio-accent/[0.07] border-studio-accent/25"
          : "bg-transparent border-transparent hover:bg-overlay-xs hover:border-overlay-sm"
      )}
    >
      {/* Status badge + version — top-right */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
        {item.version != null && item.version > 1 && (
          <span className="text-sm font-bold uppercase tracking-wide text-dim-3">
            v{item.version}
          </span>
        )}
        <span
          className={cn(
            "text-sm font-bold px-1.5 py-[2px] rounded-full uppercase tracking-[0.4px]",
            STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
          )}
        >
          {item.status}
        </span>
      </div>

      {/* Hook text */}
      <p
        className={cn(
          "text-sm font-medium leading-[1.45] line-clamp-2 pr-20 mb-1.5",
          isSelected ? "text-primary" : "text-dim-1"
        )}
      >
        {hookPreview ?? `${t("studio_queue_itemLabel")} #${item.id}`}
      </p>

      {/* Pipeline dots + meta row */}
      <div className="flex items-center gap-2">
        {(item.stages ?? []).length > 0 && (
          <div className="flex items-center gap-[5px]">
            {item.stages.map((stage) => (
              <span
                key={stage.id}
                title={`${stage.label}: ${stage.status}`}
                className={cn(
                  "w-[5px] h-[5px] rounded-full flex-shrink-0",
                  STAGE_DOT[stage.status]
                )}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-dim-3 ml-auto truncate">
          {item.projectName && (
            <span className="text-violet-400/45 truncate max-w-[80px]">
              ◆ {item.projectName}
            </span>
          )}
          {item.scheduledFor ? (
            <span className="shrink-0">
              {new Date(item.scheduledFor).toLocaleDateString()}
            </span>
          ) : (
            <span className="shrink-0 text-dim-3">
              {t("studio_queue_unscheduled")}
            </span>
          )}
        </div>
      </div>

      {/* Inline alerts */}
      {failedStages.length > 0 && (
        <p className="text-sm text-error mt-1">
          {failedStages.map((s) => s.label).join(", ")}{" "}
          {t("studio_queue_stage_failed")}
        </p>
      )}
      {failedStages.length === 0 && runningStages.length > 0 && (
        <p className="text-sm text-warning mt-1">
          {runningStages.map((s) => s.label).join(", ")}…
        </p>
      )}

      {/* Version navigation — inside the card */}
      <div
        className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-overlay-sm/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canGoLeft) setActiveIdx(activeIdx - 1);
          }}
          disabled={!canGoLeft}
          className={cn(
            "p-0.5 rounded transition-colors",
            canGoLeft
              ? "text-dim-2 hover:text-primary hover:bg-overlay-sm cursor-pointer"
              : "text-dim-3/30 cursor-default"
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1.5">
          {sortedItems.map((v, i) => (
            <button
              key={v.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIdx(i);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all cursor-pointer",
                i === activeIdx
                  ? "bg-studio-accent scale-125"
                  : "bg-overlay-lg hover:bg-dim-3"
              )}
              title={`v${v.version ?? i + 1}`}
            />
          ))}
          <span className="text-[10px] font-bold text-dim-3 ml-1 tabular-nums uppercase tracking-wide">
            {t("studio_queue_version_of", {
              version: item.version ?? activeIdx + 1,
              total: sortedItems.length,
            })}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canGoRight) setActiveIdx(activeIdx + 1);
          }}
          disabled={!canGoRight}
          className={cn(
            "p-0.5 rounded transition-colors",
            canGoRight
              ? "text-dim-2 hover:text-primary hover:bg-overlay-sm cursor-pointer"
              : "text-dim-3/30 cursor-default"
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hover actions */}
      {item.status !== "posted" && (
        <div
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 transition-all duration-150",
            "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(item.id);
            }}
            disabled={duplicatingId === item.id}
            title={t("studio_queue_duplicate")}
            className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors disabled:opacity-50"
          >
            {duplicatingId === item.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            disabled={deletingId === item.id}
            title={t("studio_queue_delete")}
            className="p-1.5 rounded-md bg-studio-surface text-error hover:bg-error/20 transition-colors disabled:opacity-50"
          >
            {deletingId === item.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
