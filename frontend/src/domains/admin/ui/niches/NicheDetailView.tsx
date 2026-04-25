import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Zap,
  GitMerge,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Badge } from "@/shared/ui/primitives/badge";
import { Checkbox } from "@/shared/ui/primitives/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/ui/primitives/tabs";
import {
  useNicheReels,
  useNicheJobs,
  useScanNiche,
  useDedupeNiche,
  useDeleteAdminReel,
  useNiches,
  type NicheReelsParams,
  type ScrapeConfigOverride,
} from "@/domains/admin/hooks/use-niches";
import { NicheToast } from "./NicheToast";
import { NicheReelRow } from "./NicheReelRow";
import { NicheJobRow } from "./NicheJobRow";
import { NicheScanStatusBanner } from "./NicheScanStatusBanner";
import { NicheEditModal } from "./NicheEditModal";
import { NicheScrapeOptionsModal } from "./NicheScrapeOptionsModal";

// ── Main View ─────────────────────────────────────────────────────────────────

export function NicheDetailView({ nicheId }: { nicheId: number }) {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [scrapeOptionsOpen, setScrapeOptionsOpen] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
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

  const handleScan = async (config: ScrapeConfigOverride = {}) => {
    try {
      await scan.mutateAsync({ nicheId, config });
      setScrapeOptionsOpen(false);
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
    setIsDeletingSelected(true);
    await Promise.allSettled(
      ids.map((id) => deleteReel.mutateAsync({ reelId: id, nicheId }))
    );
    setSelected(new Set());
    showToast(`Deleted ${ids.length} reel(s)`, "success");
    setIsDeletingSelected(false);
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
      {toast && <NicheToast message={toast.msg} type={toast.type} />}
      {niche && (
        <NicheEditModal
          niche={niche}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      {niche && (
        <NicheScrapeOptionsModal
          niche={niche}
          open={scrapeOptionsOpen}
          onClose={() => setScrapeOptionsOpen(false)}
          onRun={handleScan}
          isPending={scan.isPending}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Link
            to="/admin/niches"
            className="inline-flex items-center gap-2 text-sm text-dim-2 hover:text-studio-fg transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("admin_niche_back_to_niches")}
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-studio-fg">
                {niche?.name ?? `Niche #${nicheId}`}
              </h2>
              {niche?.description && (
                <p className="text-base text-dim-2 mt-1">{niche.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setScrapeOptionsOpen(true)}
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
                className="text-dim-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {activeJob && <NicheScanStatusBanner job={activeJob} />}

        <Tabs defaultValue="reels" className="gap-4">
          <TabsList className="bg-background rounded-none border-b p-0">
            <TabsTrigger
              value="reels"
              className="bg-background data-[state=active]:border-primary h-full rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none!"
            >
              {t("admin_niche_tab_reels")}
              {data && (
                <Badge variant="secondary" className="ml-2 text-sm px-1.5 py-0">
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
                <SelectTrigger className="h-8 w-[160px] text-sm">
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
                className="h-8 px-3 text-sm"
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
                <SelectTrigger className="h-8 w-[130px] text-sm">
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
                className="h-8 text-sm"
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
                  className="h-8 text-sm text-dim-2"
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
                  className="h-7 gap-2 text-sm text-dim-2 hover:text-studio-fg"
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
                    <span className="text-sm text-dim-3">
                      {t("admin_niche_selected_count", {
                        count: selected.size,
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-sm text-error hover:text-error hover:bg-error/10"
                      onClick={handleDeleteSelected}
                      disabled={isDeletingSelected}
                    >
                      <Trash2 className="h-3 w-3" />
                      {isDeletingSelected
                        ? t("admin_niche_deleting")
                        : t("admin_niche_delete_selected")}
                    </Button>
                  </>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-sm"
                  onClick={handleExport}
                >
                  <Download className="h-3 w-3" />
                  {t("admin_niche_export")}
                </Button>
              </div>
            )}

            {/* Reels table */}
            <div className="rounded-2xl border border-overlay-sm overflow-hidden">
              <div className="grid grid-cols-[44px_1fr_90px_90px_140px] text-sm font-semibold uppercase tracking-wider text-dim-3 bg-overlay-xs px-4 py-3 border-b border-overlay-sm">
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
                      <div className="h-4 w-4 bg-overlay-sm rounded" />
                      <div className="h-4 flex-1 bg-overlay-sm rounded" />
                      <div className="h-4 w-16 bg-overlay-sm rounded" />
                      <div className="h-4 w-16 bg-overlay-sm rounded" />
                      <div className="h-7 w-20 bg-overlay-sm rounded-lg ml-auto" />
                    </div>
                  ))}
                </div>
              ) : reels.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <p className="text-base text-dim-3 font-medium">
                    {t("admin_niche_empty_no_reels")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-sm"
                    onClick={() => setScrapeOptionsOpen(true)}
                  >
                    {t("admin_niche_empty_no_reels_hint")}
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {reels.map((reel) => (
                    <NicheReelRow
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
                <span className="text-sm text-dim-2">
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
            <div className="rounded-2xl border border-overlay-sm overflow-hidden">
              <div className="grid grid-cols-[140px_90px_100px_80px_80px_1fr] text-sm font-semibold uppercase tracking-wider text-dim-3 bg-overlay-xs px-4 py-3 border-b border-overlay-sm gap-2">
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
                      <div className="h-4 w-32 bg-overlay-sm rounded" />
                      <div className="h-4 w-16 bg-overlay-sm rounded" />
                      <div className="h-4 w-24 bg-overlay-sm rounded" />
                    </div>
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <p className="text-base text-dim-3 font-medium">
                    {t("admin_niche_empty_no_jobs")}
                  </p>
                  <p className="text-sm text-dim-3">
                    {t("admin_niche_empty_no_jobs_hint")}
                  </p>
                </div>
              ) : (
                jobs.map((job) => <NicheJobRow key={job.id} job={job} />)
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-base font-medium text-dim-3">
                Analytics coming soon
              </p>
              <p className="text-sm text-dim-3">
                Per-niche engagement trends and growth charts will appear here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
