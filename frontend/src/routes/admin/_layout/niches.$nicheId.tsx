import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Zap,
  GitMerge,
  Pencil,
  Trash2,
  Download,
  CheckSquare,
  Square,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  useNicheReels,
  useScanNiche,
  useDedupeNiche,
  useDeleteAdminReel,
  useNiches,
  useUpdateNiche,
  type AdminNicheReel,
  type AdminNiche,
} from "@/features/admin/hooks/use-niches";
import { cn } from "@/shared/utils/helpers/utils";

export const Route = createFileRoute("/admin/_layout/niches/$nicheId")({
  component: NicheDetailPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

// ── Toast-style feedback ──────────────────────────────────────────────────────

function Toast({ message, type = "info" }: { message: string; type?: "info" | "success" | "error" }) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-[13px] font-medium border max-w-xs",
        type === "success" && "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
        type === "error" && "bg-red-500/20 border-red-500/30 text-red-400",
        type === "info" && "bg-studio-accent/20 border-studio-accent/30 text-studio-accent",
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
  const [expanded, setExpanded] = useState(false);
  const deleteReel = useDeleteAdminReel();

  return (
    <>
      <div
        className="grid grid-cols-[44px_1fr_90px_90px_140px] items-center px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onSelect(reel.id, !selected); }}
          className="flex items-center"
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-studio-accent" />
          ) : (
            <Square className="h-4 w-4 text-slate-200/20" />
          )}
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
          {reel.engagementRate ? `${Number(reel.engagementRate).toFixed(1)}%` : "—"}
        </span>
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {reel.videoUrl && (
            <a href={reel.videoUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
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

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-[52px] pb-4 bg-white/[0.01] border-t border-white/[0.04] grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            ["Likes", fmtNum(reel.likes)],
            ["Comments", fmtNum(reel.comments)],
            ["Audio", reel.audioName ?? "—"],
            ["Viral", reel.isViral ? "Yes" : "No"],
            ["Has Analysis", reel.hasAnalysis ? "Yes" : "No"],
            ["Caption", reel.caption ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2 py-1">
              <span className="text-[11px] text-slate-200/30 w-28 shrink-0">{label}</span>
              <span className="text-[12px] text-slate-200/70 truncate">{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Edit Modal (inline) ───────────────────────────────────────────────────────

function NicheEditModal({
  niche,
  onClose,
}: {
  niche: AdminNiche;
  onClose: () => void;
}) {
  const [name, setName] = useState(niche.name);
  const [description, setDescription] = useState(niche.description ?? "");
  const [isActive, setIsActive] = useState(niche.isActive);
  const [error, setError] = useState("");
  const update = useUpdateNiche();

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-studio-surface border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold">Edit Niche</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl h-10 px-4 text-[13px] text-studio-fg outline-none focus:border-studio-accent/50 transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-studio-fg outline-none focus:border-studio-accent/50 transition-colors resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                isActive ? "bg-studio-accent" : "bg-white/[0.12]",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            <span className="text-[13px] text-slate-200/60">{isActive ? "Active" : "Inactive"}</span>
          </div>
          {error && <p className="text-[12px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "reels" | "history" | "analytics";

function NicheDetailPage() {
  const { nicheId: nicheIdStr } = Route.useParams();
  const nicheId = parseInt(nicheIdStr, 10);

  const [tab, setTab] = useState<Tab>("reels");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "info" | "success" | "error" } | null>(null);

  const nichesData = useNiches();
  const niche = nichesData.data?.niches.find((n) => n.id === nicheId);

  const { data, isLoading, refetch } = useNicheReels(nicheId, page);
  const reels = data?.reels ?? [];
  const totalPages = data?.totalPages ?? 1;

  const scan = useScanNiche();
  const dedupe = useDedupeNiche();
  const deleteReel = useDeleteAdminReel();

  const showToast = (msg: string, type: "info" | "success" | "error" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleScan = async () => {
    try {
      const result = await scan.mutateAsync(nicheId);
      showToast(`Scan queued! Job ID: ${result.jobId}`, "success");
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
    await Promise.allSettled(ids.map((id) => deleteReel.mutateAsync({ reelId: id, nicheId })));
    setSelected(new Set());
    showToast(`Deleted ${ids.length} reel(s)`, "success");
  };

  const handleExport = () => {
    const url = `/api/admin/niches/${nicheId}/reels?limit=1000&page=1`;
    window.open(url, "_blank");
  };

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} />}
      {editOpen && niche && (
        <NicheEditModal niche={niche} onClose={() => setEditOpen(false)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Link
            to="/admin/niches"
            className="inline-flex items-center gap-2 text-[12px] text-slate-200/40 hover:text-studio-fg transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Niches
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-studio-fg">
                {niche?.name ?? `Niche #${nicheId}`}
              </h2>
              {niche?.description && (
                <p className="text-[13px] text-slate-200/40 mt-1">{niche.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleScan}
                disabled={scan.isPending}
              >
                <Zap className="h-3.5 w-3.5" />
                {scan.isPending ? "Queuing…" : "Trigger Scrape"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDedupe}
                disabled={dedupe.isPending}
              >
                <GitMerge className="h-3.5 w-3.5" />
                {dedupe.isPending ? "Running…" : "Run Dedupe"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Niche
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

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(["reels", "history", "analytics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 transition-colors -mb-px",
                tab === t
                  ? "border-studio-accent text-studio-accent"
                  : "border-transparent text-slate-200/40 hover:text-studio-fg",
              )}
            >
              {t}
              {t === "reels" && data && (
                <span className="ml-2 text-[11px] bg-white/[0.06] rounded-full px-1.5 py-0.5">
                  {data.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "reels" && (
          <div className="space-y-3">
            {/* Bulk actions bar */}
            {reels.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-[12px] text-slate-200/40 hover:text-studio-fg transition-colors"
                >
                  {selected.size === reels.length && reels.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-studio-accent" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Select All
                </button>
                {selected.size > 0 && (
                  <>
                    <span className="text-[12px] text-slate-200/30">
                      {selected.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete Selected
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
                  Export
                </Button>
              </div>
            )}

            {/* Reels table */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[44px_1fr_90px_90px_140px] text-[11px] font-semibold uppercase tracking-wider text-slate-200/30 bg-white/[0.02] px-4 py-3 border-b border-white/[0.06]">
                <span />
                <span>Title / Hook</span>
                <span>Views</span>
                <span>Engagement</span>
                <span className="text-right">Actions</span>
              </div>

              {isLoading ? (
                <div className="divide-y divide-white/[0.04]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-4 py-4 flex gap-4 items-center animate-pulse">
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
                  <p className="text-[14px] text-slate-200/25 font-medium">No reels yet</p>
                  <button
                    onClick={handleScan}
                    className="text-[12px] text-studio-accent hover:underline"
                  >
                    Trigger a scrape to populate reels
                  </button>
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
                  ← Prev
                </Button>
                <span className="text-[12px] text-slate-200/40">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-[14px] font-medium text-slate-200/25">Scrape history coming soon</p>
            <p className="text-[12px] text-slate-200/15">
              Job logs and run history will appear here once the scraping service is integrated.
            </p>
          </div>
        )}

        {tab === "analytics" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-[14px] font-medium text-slate-200/25">Analytics coming soon</p>
            <p className="text-[12px] text-slate-200/15">
              Per-niche engagement trends and growth charts will appear here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
