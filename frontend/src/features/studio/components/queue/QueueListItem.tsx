import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { Check, X, Loader2, Copy } from "lucide-react";
import type { QueueItem } from "@/features/reels/types/reel.types";
import { STATUS_STYLES, STAGE_DOT } from "./queue.types";

export function QueueListItem({
  item,
  selected,
  onClick,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: {
  item: QueueItem;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 85) +
      (item.generatedHook.length > 85 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter(
    (s) => s.status === "running"
  );

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 border",
        selected
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
          selected ? "text-primary" : "text-dim-1"
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

      {/* Hover actions (bottom-right) */}
      {item.status !== "posted" && (
        <div
          className={cn(
            "absolute bottom-2 right-2 flex items-center gap-1 transition-all duration-150",
            confirmDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            <>
              <span className="text-sm text-dim-3 mr-0.5">
                {t("studio_queue_delete_prompt")}
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded-md bg-error/25 text-error hover:bg-error/35 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                disabled={isDuplicating}
                title={t("studio_queue_duplicate")}
                className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors disabled:opacity-50"
              >
                {isDuplicating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleDelete}
                title={t("studio_queue_delete")}
                className="p-1.5 rounded-md bg-studio-surface text-error hover:bg-error/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
