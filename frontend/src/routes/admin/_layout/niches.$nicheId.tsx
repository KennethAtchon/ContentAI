import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Zap,
  GitMerge,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/components/ui/tabs";
import {
  useNicheReels,
  useNicheJobs,
  useScanNiche,
  useDedupeNiche,
  useDeleteAdminReel,
  useNiches,
  useUpdateNiche,
  type AdminNicheReel,
  type AdminNiche,
  type ScrapeJob,
  type NicheReelsParams,
} from "@/features/admin/hooks/use-niches";
import { cn } from "@/shared/utils/helpers/utils";

export const Route = createFileRoute("/admin/_layout/niches/$nicheId")({
  head: ({ params }) => ({
    meta: [{ title: `Niche #${params.nicheId} — Admin` }],
  }),
  component: NicheDetailPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type = "info",
}: {
  message: string;
  type?: "info" | "success" | "error";
}) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-[13px] font-medium border max-w-xs",
        type === "success" &&
          "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
        type === "error" && "bg-red-500/20 border-red-500/30 text-red-400",
        type === "info" &&
          "bg-studio-accent/20 border-studio-accent/30 text-studio-accent"
      )}
    >
      {message}
    </div>
  );
}

// ── Reel Row ──────────────────────────────────────────────────────────────────

function ReelRow({
  reel,
  nicheId,
  selected,
  onSelect,
}: {
  reel: AdminNicheReel;
  nicheId: number;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const deleteReel = useDeleteAdminReel();

  return (
    <>
      <div
        className="grid grid-cols-[44px_1fr_90px_90px_140px] items-center px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(reel.id, !!checked)}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-studio-fg truncate font-medium">
            {reel.hook ?? reel.caption ?? `@${reel.username}`}
          </p>
          <p className="text-[11px] text-slate-200/30">@{reel.username}</p>
        </div>
        <span className="text-[13px] text-slate-200/60 tabular-nums">
          {fmtNum(reel.views)}
        </span>
        <span className="text-[13px] text-slate-200/60 tabular-nums">
          {reel.engagementRate
            ? `${Number(reel.engagementRate).toFixed(1)}%`
            : "—"}
        </span>
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {reel.videoUrl && (
            <a href={reel.videoUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px]"
              >
                <Eye className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-400/10"
            onClick={() => deleteReel.mutate({ reelId: reel.id, nicheId })}
            disabled={deleteReel.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-slate-200/20" />
          ) : (
            <ChevronDown className="h-3 w-3 text-slate-200/20" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-[52px] pb-4 bg-white/[0.01] border-t border-white/[0.04] grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            [t("admin_niche_row_likes"), fmtNum(reel.likes)],
            [t("admin_niche_row_comments"), fmtNum(reel.comments)],
            [t("admin_niche_row_audio"), reel.audioName ?? "—"],
            [t("admin_niche_row_viral"), reel.isViral ? "Yes" : "No"],
            [
              t("admin_niche_row_has_analysis"),
              reel.hasAnalysis ? "Yes" : "No",
            ],
            [t("admin_niche_row_caption"), reel.caption ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2 py-1">
              <span className="text-[11px] text-slate-200/30 w-28 shrink-0">
                {label}
              </span>
              <span className="text-[12px] text-slate-200/70 truncate">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Job Row ───────────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<ScrapeJob["status"], string> = {
  queued: "bg-slate-200/10 text-slate-200/50 border-transparent",
  running: "bg-blue-500/20 text-blue-400 border-transparent",
  completed: "bg-emerald-500/20 text-emerald-400 border-transparent",
  failed: "bg-red-500/20 text-red-400 border-transparent",
};

function JobRow({ job }: { job: ScrapeJob }) {
  const created = new Date(job.createdAt);
  const durationMs = job.result?.durationMs;

  return (
    <div className="px-4 py-3 grid grid-cols-[140px_90px_100px_80px_80px_1fr] items-center gap-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-slate-200/40 font-mono truncate">
        {job.id}
      </span>
      <Badge className={cn("text-[11px] w-fit", STATUS_CLASS[job.status])}>
        {job.status}
      </Badge>
      <span className="text-[11px] text-slate-200/40">
        {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" · "}
        {created.toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>
      <span className="text-[11px] text-slate-200/60 tabular-nums">
        {job.result ? `+${job.result.saved}` : job.startedAt ? "…" : "—"}
      </span>
      <span className="text-[11px] text-slate-200/40 tabular-nums">
        {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
      </span>
      {job.error ? (
        <span className="text-[11px] text-red-400 truncate" title={job.error}>
          {job.error}
        </span>
      ) : job.result ? (
        <span className="text-[11px] text-slate-200/30">
          {job.result.skipped} skipped
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

// ── Scan Status Banner ────────────────────────────────────────────────────────

function ScanStatusBanner({ job }: { job: ScrapeJob }) {
  const { t } = useTranslation();

  if (job.status === "completed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-[13px] font-medium">
          {t("admin_niche_scan_complete", {
            saved: job.result?.saved ?? 0,
            skipped: job.result?.skipped
              ? t("admin_niche_skipped", { count: job.result.skipped })
              : "",
            duration: job.result?.durationMs
              ? t("admin_niche_duration_suffix", {
                  seconds: (job.result.durationMs / 1000).toFixed(1),
                })
              : "",
          })}
        </span>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
        <span className="text-[13px] font-medium">
          {t("admin_niche_scan_failed")}
          {job.error ? `: ${job.error}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
      </span>
      <span className="text-[13px] font-medium">
        {job.status === "queued"
          ? t("admin_niche_scan_queued")
          : t("admin_niche_scraping")}
      </span>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function NicheEditModal({
  niche,
  open,
  onClose,
}: {
  niche: AdminNiche;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(niche.name);
  const [description, setDescription] = useState(niche.description ?? "");
  const [isActive, setIsActive] = useState(niche.isActive);
  const [error, setError] = useState("");
  const update = useUpdateNiche();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      await update.mutateAsync({ id: niche.id, name, description, isActive });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin_niche_edit_modal_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-[13px] text-slate-200/60">
              {isActive ? t("common_active") : t("common_unavailable")}
            </span>
          </div>
          {error && (
            <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? `${t("common_save")}…` : t("common_save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function NicheDetailPage() {
  const { t } = useTranslation();
  const { nicheId: nicheIdStr } = Route.useParams();
  const nicheId = parseInt(nicheIdStr, 10);

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "info" | "success" | "error";
  } | null>(null);
  const [reelParams, setReelParams] = useState<NicheReelsParams>({
    sortBy: "views",
    sortOrder: "desc",
  });

  const nichesData = useNiches();
  const niche = nichesData.data?.niches.find((n) => n.id === nicheId);

  const { data, isLoading, refetch } = useNicheReels(nicheId, {
    ...reelParams,
    page,
  });
  const reels = data?.reels ?? [];
  const totalPages = data?.totalPages ?? 1;

  const { data: jobsData, isLoading: jobsLoading } = useNicheJobs(nicheId);
  const jobs = jobsData?.jobs ?? [];
  const activeJob =
    jobs.find(
      (j) =>
        j.status === "queued" ||
        j.status === "running" ||
        j.status === "completed" ||
        j.status === "failed"
    ) ?? null;
  const isScanBusy =
    activeJob?.status === "queued" || activeJob?.status === "running";

  useEffect(() => {
    if (activeJob?.status === "completed") refetch();
  }, [activeJob?.status, refetch]);

  const scan = useScanNiche();
  const dedupe = useDedupeNiche();
  const deleteReel = useDeleteAdminReel();

  const showToast = (
    msg: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleScan = async () => {
    try {
      await scan.mutateAsync(nicheId);
    } catch {
      showToast("Failed to queue scan", "error");
    }
  };

  const handleDedupe = async () => {
    try {
      const result = await dedupe.mutateAsync(nicheId);
      showToast(result.message, "success");
    } catch {
      showToast("Deduplication failed", "error");
    }
  };

  const handleSelectAll = () => {
    if (selected.size === reels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reels.map((r) => r.id)));
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await Promise.allSettled(
      ids.map((id) => deleteReel.mutateAsync({ reelId: id, nicheId }))
    );
    setSelected(new Set());
    showToast(`Deleted ${ids.length} reel(s)`, "success");
  };

  const handleExport = () => {
    window.open(
      `/api/admin/niches/${nicheId}/reels?limit=1000&page=1`,
      "_blank"
    );
  };

  const isFilterActive = !!(
    reelParams.viral ||
    reelParams.hasVideo ||
    reelParams.sortBy !== "views" ||
    reelParams.sortOrder !== "desc"
  );

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      {niche && (
        <NicheEditModal
          niche={niche}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Link
            to="/admin/niches"
            className="inline-flex items-center gap-2 text-[12px] text-slate-200/40 hover:text-studio-fg transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("admin_niche_back_to_niches")}
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-studio-fg">
                {niche?.name ?? `Niche #${nicheId}`}
              </h2>
              {niche?.description && (
                <p className="text-[13px] text-slate-200/40 mt-1">
                  {niche.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleScan}
                disabled={scan.isPending || isScanBusy}
              >
                <Zap className="h-3.5 w-3.5" />
                {scan.isPending
                  ? t("admin_niche_queuing")
                  : isScanBusy
                    ? t("admin_niche_scanning")
                    : t("admin_niche_trigger_scrape")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDedupe}
                disabled={dedupe.isPending}
              >
                <GitMerge className="h-3.5 w-3.5" />
                {dedupe.isPending
                  ? t("admin_niche_running")
                  : t("admin_niche_run_dedupe")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("admin_niche_edit_modal_title")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="text-slate-200/40"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {activeJob && <ScanStatusBanner job={activeJob} />}

        <Tabs defaultValue="reels" className="gap-4">
          <TabsList className="bg-background rounded-none border-b p-0">
            <TabsTrigger
              value="reels"
              className="bg-background data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none!"
            >
              {t("admin_niche_tab_reels")}
              {data && (
                <Badge
                  variant="secondary"
                  className="ml-2 text-[10px] px-1.5 py-0"
                >
                  {data.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="bg-background data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none!"
            >
              {t("admin_niche_tab_history")}
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="bg-background data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none!"
            >
              {t("admin_niche_tab_analytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reels" className="space-y-3 mt-4">
            {/* Filter / sort toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={reelParams.sortBy ?? "views"}
                onValueChange={(v) => {
                  setPage(1);
                  setReelParams((p) => ({
                    ...p,
                    sortBy: v as NicheReelsParams["sortBy"],
                  }));
                }}
              >
                <SelectTrigger className="h-8 w-[160px] text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">
                    {t("admin_niche_toolbar_sort_by", {
                      field: t("admin_niche_sort_views"),
                    })}
                  </SelectItem>
                  <SelectItem value="likes">
                    {t("admin_niche_toolbar_sort_by", {
                      field: t("admin_niche_sort_likes"),
                    })}
                  </SelectItem>
                  <SelectItem value="engagement">
                    {t("admin_niche_toolbar_sort_by", {
                      field: t("admin_niche_sort_engagement"),
                    })}
                  </SelectItem>
                  <SelectItem value="postedAt">
                    {t("admin_niche_toolbar_sort_by", {
                      field: t("admin_niche_sort_posted_date"),
                    })}
                  </SelectItem>
                  <SelectItem value="scrapedAt">
                    {t("admin_niche_toolbar_sort_by", {
                      field: t("admin_niche_sort_scraped_date"),
                    })}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[12px]"
                onClick={() => {
                  setPage(1);
                  setReelParams((p) => ({
                    ...p,
                    sortOrder: p.sortOrder === "asc" ? "desc" : "asc",
                  }));
                }}
              >
                {reelParams.sortOrder === "asc"
                  ? t("admin_niche_sort_order_asc")
                  : t("admin_niche_sort_order_desc")}
              </Button>
              <Select
                value={reelParams.viral ?? "all"}
                onValueChange={(v) => {
                  setPage(1);
                  setReelParams((p) => ({
                    ...p,
                    viral:
                      v === "all"
                        ? undefined
                        : (v as NicheReelsParams["viral"]),
                  }));
                }}
              >
                <SelectTrigger className="h-8 w-[130px] text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin_niche_filter_all_posts")}
                  </SelectItem>
                  <SelectItem value="true">
                    {t("admin_niche_filter_viral_only")}
                  </SelectItem>
                  <SelectItem value="false">
                    {t("admin_niche_filter_non_viral")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={reelParams.hasVideo ? "default" : "outline"}
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => {
                  setPage(1);
                  setReelParams((p) => ({
                    ...p,
                    hasVideo: p.hasVideo ? undefined : "true",
                  }));
                }}
              >
                {t("admin_niche_filter_has_video")}
              </Button>
              {isFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[12px] text-slate-200/40"
                  onClick={() => {
                    setPage(1);
                    setReelParams({ sortBy: "views", sortOrder: "desc" });
                  }}
                >
                  {t("admin_niche_toolbar_reset")}
                </Button>
              )}
            </div>

            {/* Bulk actions bar */}
            {reels.length > 0 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-2 text-[12px] text-slate-200/40 hover:text-studio-fg"
                  onClick={handleSelectAll}
                >
                  <Checkbox
                    checked={selected.size === reels.length && reels.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  {t("admin_niche_select_all")}
                </Button>
                {selected.size > 0 && (
                  <>
                    <span className="text-[12px] text-slate-200/30">
                      {t("admin_niche_selected_count", {
                        count: selected.size,
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      onClick={handleDeleteSelected}
                      disabled={deleteReel.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                      {deleteReel.isPending
                        ? t("admin_niche_deleting")
                        : t("admin_niche_delete_selected")}
                    </Button>
                  </>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={handleExport}
                >
                  <Download className="h-3 w-3" />
                  {t("admin_niche_export")}
                </Button>
              </div>
            )}

            {/* Reels table */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[44px_1fr_90px_90px_140px] text-[11px] font-semibold uppercase tracking-wider text-slate-200/30 bg-white/[0.02] px-4 py-3 border-b border-white/[0.06]">
                <span />
                <span>{t("admin_niche_col_hook")}</span>
                <span>{t("admin_niche_col_views")}</span>
                <span>{t("admin_niche_col_engagement")}</span>
                <span className="text-right">
                  {t("admin_niche_col_actions")}
                </span>
              </div>

              {isLoading ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="px-4 py-4 flex gap-4 items-center animate-pulse"
                    >
                      <div className="h-4 w-4 bg-white/[0.05] rounded" />
                      <div className="h-4 flex-1 bg-white/[0.05] rounded" />
                      <div className="h-4 w-16 bg-white/[0.05] rounded" />
                      <div className="h-4 w-16 bg-white/[0.05] rounded" />
                      <div className="h-7 w-20 bg-white/[0.05] rounded-lg ml-auto" />
                    </div>
                  ))}
                </div>
              ) : reels.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <p className="text-[14px] text-slate-200/25 font-medium">
                    {t("admin_niche_empty_no_reels")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-[12px]"
                    onClick={handleScan}
                  >
                    {t("admin_niche_empty_no_reels_hint")}
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {reels.map((reel) => (
                    <ReelRow
                      key={reel.id}
                      reel={reel}
                      nicheId={nicheId}
                      selected={selected.has(reel.id)}
                      onSelect={handleSelectOne}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("common_pagination_previous")}
                </Button>
                <span className="text-[12px] text-slate-200/40">
                  {t("common_pagination_showing", {
                    page,
                    totalPages,
                    total: data?.total ?? 0,
                    item: t("admin_niche_tab_reels").toLowerCase(),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common_pagination_next")}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[140px_90px_100px_80px_80px_1fr] text-[11px] font-semibold uppercase tracking-wider text-slate-200/30 bg-white/[0.02] px-4 py-3 border-b border-white/[0.06] gap-2">
                <span>{t("admin_niche_col_job_id")}</span>
                <span>{t("admin_niche_col_status")}</span>
                <span>{t("admin_niche_col_started")}</span>
                <span>{t("admin_niche_col_saved")}</span>
                <span>{t("admin_niche_col_duration")}</span>
                <span>{t("admin_niche_col_info")}</span>
              </div>
              {jobsLoading ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-4 flex gap-4 animate-pulse">
                      <div className="h-4 w-32 bg-white/[0.05] rounded" />
                      <div className="h-4 w-16 bg-white/[0.05] rounded" />
                      <div className="h-4 w-24 bg-white/[0.05] rounded" />
                    </div>
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <p className="text-[14px] text-slate-200/25 font-medium">
                    {t("admin_niche_empty_no_jobs")}
                  </p>
                  <p className="text-[12px] text-slate-200/15">
                    {t("admin_niche_empty_no_jobs_hint")}
                  </p>
                </div>
              ) : (
                jobs.map((job) => <JobRow key={job.id} job={job} />)
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[14px] font-medium text-slate-200/25">
                Analytics coming soon
              </p>
              <p className="text-[12px] text-slate-200/15">
                Per-niche engagement trends and growth charts will appear here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
