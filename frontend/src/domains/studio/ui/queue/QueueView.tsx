import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";
import { Loader2 } from "lucide-react";
import { QueueListItem } from "./QueueListItem";
import { StackedQueueCard } from "./StackedQueueCard";
import { DetailPanel } from "./DetailPanel";
import { useQueueView } from "../../hooks/use-queue-view";

export function QueueView() {
  const { t } = useTranslation();
  const {
    data,
    deleteItem,
    detailData,
    detailItemId,
    detailLoading,
    duplicateItem,
    filters,
    isLoading,
    items,
    projectFilter,
    projects,
    searchInput,
    selectedItem,
    selectedProjectExists,
    setDetailItemId,
    setProjectFilter,
    setSearchInput,
    setStatusFilter,
    statusFilter,
    versionGroups,
  } = useQueueView();

  return (
    <div className="h-full grid grid-cols-[340px_1fr] overflow-hidden">
      {/* ── Left: list panel ─────────────────────────── */}
      <div className="border-r border-overlay-sm flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="px-4 pt-4 pb-3 shrink-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-primary tracking-tight">
              {t("studio_queue_title")}
            </h1>
            {data && (
              <span className="text-sm font-bold px-1.5 py-[2px] rounded-full bg-studio-accent/15 text-studio-accent tabular-nums">
                {data.total}
              </span>
            )}
          </div>

          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("studio_queue_search_placeholder")}
            className="w-full text-sm px-3 py-1.5 rounded-lg border bg-overlay-xs text-dim-1 border-overlay-md placeholder:text-dim-3 focus:outline-none focus:border-studio-accent/30 transition-colors"
          />

          {/* Status filter pills */}
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "text-sm font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 cursor-pointer transition-all duration-150 capitalize",
                  statusFilter === f
                    ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
                    : "bg-transparent text-dim-3 border-overlay-md hover:text-dim-2 hover:border-overlay-lg"
                )}
              >
                {t(`studio_queue_filter_${f}`)}
              </button>
            ))}
          </div>

          {projects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-7 text-sm font-medium border bg-overlay-xs text-dim-2 border-overlay-md focus:outline-none focus:border-studio-accent/30 transition-colors rounded-lg [&>svg]:h-3 [&>svg]:w-3">
                <SelectValue
                  placeholder={t("studio_queue_filter_all_projects")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("studio_queue_filter_all_projects")}
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="h-px bg-overlay-sm mx-3 shrink-0" />

        {/* Scrollable item list */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1.5 px-1.5 space-y-0.5">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="studio-skeleton h-[76px] rounded-xl" />
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
              <span className="text-4xl opacity-25">📅</span>
              <p className="text-sm font-medium text-dim-3">
                {projectFilter !== "all" && selectedProjectExists
                  ? "No queue items for this project"
                  : t("studio_queue_empty")}
              </p>
              <p className="text-sm text-dim-3">
                {projectFilter !== "all" && selectedProjectExists
                  ? "Try another project or clear the filter."
                  : t("studio_queue_emptySub")}
              </p>
            </div>
          ) : (
            versionGroups.map((group) =>
              group.items.length > 1 ? (
                <StackedQueueCard
                  key={`group-${group.rootContentId}`}
                  group={group}
                  selectedItemId={detailItemId}
                  onSelectItem={setDetailItemId}
                  onDelete={(id) => deleteItem.mutate(id)}
                  onDuplicate={(id) => duplicateItem.mutate(id)}
                  deletingId={
                    deleteItem.isPending ? deleteItem.variables : null
                  }
                  duplicatingId={
                    duplicateItem.isPending ? duplicateItem.variables : null
                  }
                />
              ) : (
                <QueueListItem
                  key={group.items[0].id}
                  item={group.items[0]}
                  selected={detailItemId === group.items[0].id}
                  onClick={() => setDetailItemId(group.items[0].id)}
                  onDelete={() => deleteItem.mutate(group.items[0].id)}
                  onDuplicate={() => duplicateItem.mutate(group.items[0].id)}
                  isDeleting={
                    deleteItem.isPending &&
                    deleteItem.variables === group.items[0].id
                  }
                  isDuplicating={
                    duplicateItem.isPending &&
                    duplicateItem.variables === group.items[0].id
                  }
                />
              )
            )
          )}
        </div>
      </div>

      {/* ── Right: detail panel ───────────────────────── */}
      <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!detailItemId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
            <div className="w-10 h-10 rounded-full border border-overlay-md bg-overlay-xs flex items-center justify-center">
              <span className="text-xl opacity-30">↖</span>
            </div>
            <p className="text-sm text-dim-3">
              {t("studio_queue_select_prompt")}
            </p>
          </div>
        ) : detailLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-white/20" />
          </div>
        ) : detailData ? (
          <DetailPanel
            detail={detailData}
            stages={selectedItem?.stages ?? []}
            onClose={() => setDetailItemId(null)}
            onDelete={() => deleteItem.mutate(detailData.queueItem.id)}
            onDuplicate={() => duplicateItem.mutate(detailData.queueItem.id)}
            isDeleting={
              deleteItem.isPending &&
              deleteItem.variables === detailData.queueItem.id
            }
            isDuplicating={
              duplicateItem.isPending &&
              duplicateItem.variables === detailData.queueItem.id
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-dim-3">
            Queue item not found. It may have been deleted.
          </div>
        )}
      </div>
    </div>
  );
}
