import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import type { QueueItem, PipelineStage } from "@/features/reels/types/reel.types";
import { Scissors, Check, X, Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

type StatusFilter = "all" | "draft" | "ready" | "scheduled" | "posted" | "failed";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/[0.06] text-slate-200/40",
  ready: "bg-violet-400/15 text-violet-400",
  queued: "bg-amber-400/15 text-amber-400",
  scheduled: "bg-blue-400/15 text-blue-400",
  posted: "bg-green-400/15 text-green-400",
  failed: "bg-red-400/15 text-red-400",
};

const STAGE_COLORS: Record<string, string> = {
  ok: "bg-green-400",
  running: "bg-amber-400 animate-pulse",
  failed: "bg-red-400",
  pending: "bg-white/15",
};

// Detail panel response shape
interface QueueDetail {
  queueItem: QueueItem;
  content: {
    id: number;
    generatedHook: string | null;
    generatedCaption: string | null;
    generatedScript: string | null;
    cleanScriptForAudio: string | null;
    sceneDescription: string | null;
    generatedMetadata: Record<string, unknown> | null;
    voiceoverUrl: string | null;
    backgroundAudioUrl: string | null;
    videoR2Url: string | null;
    status: string;
    version: number;
    outputType: string;
  } | null;
  assets: Array<{
    id: string;
    type: string;
    r2Url: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  composition: {
    id: string;
    version: number;
    editMode: string;
    updatedAt: string;
  } | null;
  sessionId: string | null;
}

function QueuePage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItemId, setDetailItemId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { user } = useApp();
  const fetcher = useQueryFetcher<{ items: QueueItem[]; total: number }>();
  const projectsFetcher = useQueryFetcher<{ projects: Project[] }>();
  const detailFetcher = useQueryFetcher<QueueDetail>();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const queueParams = {
    status: statusFilter === "all" ? undefined : statusFilter,
    projectId: projectFilter === "all" ? undefined : projectFilter,
    search: searchQuery || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.queue(queueParams),
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      if (searchQuery) params.set("search", searchQuery);
      return fetcher(`/api/queue?${params}`);
    },
    enabled: !!user,
    // Auto-refetch every 6s if any item is in an in-progress state.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((item) =>
        item.stages?.some((s) => s.status === "running" || s.status === "pending"),
      );
      return hasActive ? 6000 : false;
    },
  });

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.api.projects(),
    queryFn: () => projectsFetcher("/api/projects"),
    enabled: !!user,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["api", "queue-detail", detailItemId],
    queryFn: () => detailFetcher(`/api/queue/${detailItemId}/detail`),
    enabled: !!detailItemId,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["api", "queue"] }),
  });

  const duplicateItem = useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/queue/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      return res.json() as Promise<{ queueItem: QueueItem; newGeneratedContentId: number }>;
    },
    onSuccess: () => {
      toast.success(t("studio_queue_duplicated"));
      queryClient.invalidateQueries({ queryKey: ["api", "queue"] });
    },
    onError: () => toast.error(t("studio_queue_duplicate_failed")),
  });

  const items = data?.items ?? [];
  const projects = projectsData?.projects ?? [];
  const filters: StatusFilter[] = ["all", "draft", "ready", "scheduled", "posted", "failed"];

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="queue" />

        <div className="overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="max-w-[860px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <h1 className="text-[18px] font-bold text-slate-100">
                {t("studio_queue_title")}
              </h1>
              {data && (
                <span className="bg-studio-accent/15 text-studio-accent text-[10px] font-bold px-2 py-px rounded-full">
                  {data.total}
                </span>
              )}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "text-[11px] font-medium px-3 py-1.5 rounded-full border cursor-pointer font-studio transition-all duration-150",
                      statusFilter === f
                        ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
                        : "bg-white/[0.03] text-slate-200/40 border-white/[0.08] hover:text-slate-200/70",
                    )}
                  >
                    {t(`studio_queue_filter_${f}`)}
                  </button>
                ))}
              </div>

              {projects.length > 0 && (
                <span className="inline-flex">
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="text-[11px] font-medium px-2 py-1 rounded-full border bg-white/[0.03] text-slate-200/60 border-white/[0.08] cursor-pointer font-studio focus:outline-none focus:border-studio-accent/30 transition-colors h-[28px] min-w-[100px] [&>svg]:h-3 [&>svg]:w-3">
                      <SelectValue placeholder={t("studio_queue_filter_all_projects")} />
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
                </span>
              )}

              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("studio_queue_search_placeholder")}
                className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-full border bg-white/[0.03] text-slate-200/60 border-white/[0.08] placeholder:text-slate-200/25 focus:outline-none focus:border-studio-accent/30 transition-colors font-studio w-48"
              />
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="studio-skeleton h-[104px] rounded-[14px]" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <span className="text-[48px] opacity-40">📅</span>
                <p className="text-[15px] font-semibold text-slate-200/50">
                  {t("studio_queue_empty")}
                </p>
                <p className="text-[12px] text-slate-200/25">
                  {t("studio_queue_emptySub")}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    onEdit={() => setDetailItemId(item.id)}
                    onDelete={() => deleteItem.mutate(item.id)}
                    onDuplicate={() => duplicateItem.mutate(item.id)}
                    isDeleting={deleteItem.isPending && deleteItem.variables === item.id}
                    isDuplicating={duplicateItem.isPending && duplicateItem.variables === item.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!detailItemId} onOpenChange={(open) => { if (!open) setDetailItemId(null); }}>
        <SheetContent side="right" className="w-full max-w-[520px] bg-studio-bg border-white/10 overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
            <SheetTitle className="text-sm font-semibold text-slate-100">
              {t("studio_queue_detail_title")}
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : detailData ? (
            <DetailPanel detail={detailData} />
          ) : null}
        </SheetContent>
      </Sheet>
    </AuthGuard>
  );
}

function StageDot({ stage }: { stage: PipelineStage }) {
  return (
    <span
      title={`${stage.label}: ${stage.status}${stage.error ? ` — ${stage.error}` : ""}`}
      className={cn("inline-block w-1.5 h-1.5 rounded-full", STAGE_COLORS[stage.status])}
    />
  );
}

function QueueCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: {
  item: QueueItem;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formattedDate = item.scheduledFor
    ? new Date(item.scheduledFor).toLocaleString()
    : t("studio_queue_unscheduled");

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 120) + (item.generatedHook.length > 120 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter((s) => s.status === "running");

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-4 transition-colors hover:border-white/10">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[13px] font-semibold text-studio-fg leading-[1.4] flex-1">
          {hookPreview ?? `${t("studio_queue_itemLabel")} #${item.id}`}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.version != null && item.version > 1 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.08] text-slate-200/40 uppercase tracking-[0.5px]">
              v{item.version}
            </span>
          )}
          <span
            className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.5px]",
              STATUS_STYLES[item.status] ?? STATUS_STYLES.draft,
            )}
          >
            {item.status}
          </span>
        </div>
      </div>

      {/* Pipeline stage dots */}
      {(item.stages ?? []).length > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5">
          {item.stages.map((stage) => (
            <StageDot key={stage.id} stage={stage} />
          ))}
          {failedStages.length > 0 && (
            <span className="text-[10px] text-red-400 ml-1">
              {failedStages.map((s) => s.label).join(", ")} {t("studio_queue_stage_failed")}
            </span>
          )}
          {failedStages.length === 0 && runningStages.length > 0 && (
            <span className="text-[10px] text-amber-400 ml-1">
              {runningStages.map((s) => s.label).join(", ")}…
            </span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-slate-200/30 flex-wrap mb-3">
        <span>📅 {formattedDate}</span>
        {item.projectName && (
          <span className="text-violet-400/60">◆ {item.projectName}</span>
        )}
        {!item.projectName && <span>{t("studio_queue_no_project")}</span>}
        {item.instagramPageId && <span>📱 {item.instagramPageId}</span>}
        {item.errorMessage && (
          <span className="text-red-400">⚠ {item.errorMessage}</span>
        )}
      </div>

      {/* Actions */}
      {item.status !== "posted" && (
        <div className="flex items-center gap-2">
          {/* Edit — always available */}
          <button
            onClick={onEdit}
            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-200/60 cursor-pointer font-studio transition-all hover:text-slate-200/90 hover:border-white/20"
          >
            {t("studio_queue_edit")}
          </button>

          <button
            onClick={onDuplicate}
            disabled={isDuplicating}
            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-200/50 cursor-pointer font-studio transition-all hover:text-slate-200/80 hover:border-white/20 disabled:opacity-40 inline-flex items-center gap-1"
          >
            {isDuplicating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {t("studio_queue_duplicate")}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-slate-200/40">
                {t("studio_queue_delete_prompt")}
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-200/40 cursor-pointer font-studio transition-all hover:text-slate-200/70"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-red-400/30 bg-red-400/10 text-red-400 cursor-pointer font-studio transition-all hover:bg-red-400/20 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {t("studio_queue_delete_confirm")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-red-400/20 bg-red-400/[0.05] text-red-400 cursor-pointer font-studio transition-all hover:bg-red-400/10 ml-auto"
            >
              {t("studio_queue_delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ detail }: { detail: QueueDetail }) {
  const { t } = useTranslation();
  const { content, assets, composition, sessionId, queueItem } = detail;

  const voiceover = assets.find((a) => a.type === "voiceover");
  const music = assets.find((a) => a.type === "music");
  const videoClips = assets.filter((a) => a.type === "video_clip");
  const assembled = assets.find((a) => a.type === "assembled_video");

  return (
    <div className="px-5 py-4 space-y-5">
      {/* Copy section */}
      <DetailSection label={t("studio_queue_detail_copy")}>
        {content?.generatedHook && (
          <DetailField label={t("studio_queue_detail_hook")} value={content.generatedHook} />
        )}
        {content?.generatedCaption && (
          <DetailField label={t("studio_queue_detail_caption")} value={content.generatedCaption} />
        )}
        {content?.sceneDescription && (
          <DetailField label={t("studio_queue_detail_scene")} value={content.sceneDescription} />
        )}
        {content?.cleanScriptForAudio && (
          <DetailField label={t("studio_queue_detail_clean_script")} value={content.cleanScriptForAudio} />
        )}
      </DetailSection>

      {/* Audio */}
      <DetailSection label={t("studio_queue_detail_audio")}>
        <div className="space-y-1 text-[11px] text-slate-200/60">
          <div className="flex items-center justify-between">
            <span>{t("studio_queue_detail_voiceover")}</span>
            {voiceover?.r2Url ? (
              <a href={voiceover.r2Url} target="_blank" rel="noreferrer" className="text-studio-accent hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> {t("studio_queue_detail_listen")}
              </a>
            ) : (
              <span className="text-slate-200/25">{t("studio_queue_detail_none")}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>{t("studio_queue_detail_music")}</span>
            {music?.r2Url ? (
              <a href={music.r2Url} target="_blank" rel="noreferrer" className="text-studio-accent hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> {t("studio_queue_detail_listen")}
              </a>
            ) : content?.backgroundAudioUrl ? (
              <a href={content.backgroundAudioUrl} target="_blank" rel="noreferrer" className="text-studio-accent hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> {t("studio_queue_detail_listen")}
              </a>
            ) : (
              <span className="text-slate-200/25">{t("studio_queue_detail_none")}</span>
            )}
          </div>
        </div>
      </DetailSection>

      {/* Video */}
      <DetailSection label={t("studio_queue_detail_video")}>
        <div className="space-y-1.5 text-[11px] text-slate-200/60">
          <div className="flex items-center justify-between">
            <span>{t("studio_queue_detail_clips", { count: videoClips.length })}</span>
          </div>
          {assembled?.r2Url || content?.videoR2Url ? (
            <a
              href={(assembled?.r2Url ?? content?.videoR2Url)!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-studio-accent hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {t("studio_queue_detail_view_assembled")}
            </a>
          ) : (
            <span className="text-slate-200/25">{t("studio_queue_detail_no_video")}</span>
          )}
        </div>
      </DetailSection>

      {/* Actions */}
      <DetailSection label={t("studio_queue_detail_actions")}>
        <div className="flex flex-col gap-2">
          {content && (
            <Link
              to="/studio/editor/$generatedContentId"
              params={{ generatedContentId: String(content.id) }}
              className="inline-flex items-center gap-2 rounded-md border border-studio-accent/30 bg-studio-accent/10 px-3 py-2 text-[11px] font-medium text-studio-accent hover:bg-studio-accent/15 transition-colors"
            >
              <Scissors className="h-3.5 w-3.5" />
              {t("studio_queue_detail_open_editor")}
            </Link>
          )}
          {sessionId && (
            <Link
              to="/studio/generate"
              search={{ session: sessionId } as Record<string, string>}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-slate-200/70 hover:text-slate-200 hover:border-white/20 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("studio_queue_detail_open_chat")}
            </Link>
          )}
          {composition && (
            <p className="text-[10px] text-slate-200/30">
              {t("studio_queue_detail_composition", {
                version: composition.version,
                mode: composition.editMode,
              })}
            </p>
          )}
        </div>
      </DetailSection>

      {/* Status */}
      <DetailSection label={t("studio_queue_detail_status")}>
        <div className="text-[11px] text-slate-200/40 space-y-0.5">
          <p>{t("studio_queue_detail_queue_status")}: <span className={cn("font-semibold", STATUS_STYLES[queueItem.status]?.split(" ")[1])}>{queueItem.status}</span></p>
          {content && <p>{t("studio_queue_detail_content_status")}: {content.status}</p>}
          {queueItem.errorMessage && (
            <p className="text-red-400">⚠ {queueItem.errorMessage}</p>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-200/30">{label}</p>
      {children}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-slate-200/30">{label}</p>
      <p className="text-[12px] text-slate-200/80 leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});
