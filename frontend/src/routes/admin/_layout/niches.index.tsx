import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Database,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  useNiches,
  useCreateNiche,
  useUpdateNiche,
  useDeleteNiche,
  type AdminNiche,
} from "@/features/admin/hooks/use-niches";
import { cn } from "@/shared/utils/helpers/utils";

export const Route = createFileRoute("/admin/_layout/niches/")({
  head: () => ({ meta: [{ title: "Niches — Admin" }] }),
  component: NichesPage,
});

// ── Niche Form Modal ──────────────────────────────────────────────────────────

function NicheFormModal({
  initial,
  onClose,
}: {
  initial?: AdminNiche;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState("");

  const create = useCreateNiche();
  const update = useUpdateNiche();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (initial) {
        await update.mutateAsync({
          id: initial.id,
          name,
          description,
          isActive,
        });
      } else {
        await create.mutateAsync({ name, description, isActive });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-studio-surface border border-overlay-md rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-overlay-sm">
          <h2 className="text-xl font-semibold text-studio-fg">
            {initial ? "Edit Niche" : "Create Niche"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Personal Finance"
              className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 px-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description..."
              className="w-full bg-overlay-sm border border-overlay-md rounded-xl px-4 py-2.5 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-base text-dim-1">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? "Saving…" : initial ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function NichesPage() {
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminNiche | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useNiches(
    search || activeOnly
      ? { search: search || undefined, active: activeOnly || undefined }
      : undefined
  );
  const deleteNiche = useDeleteNiche();

  const niches = data?.niches ?? [];

  const handleDelete = async (id: number) => {
    try {
      await deleteNiche.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete niche");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {creating && <NicheFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <NicheFormModal initial={editing} onClose={() => setEditing(null)} />
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-studio-surface border border-overlay-md rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-studio-fg">
              Delete Niche?
            </h3>
            <p className="text-base text-dim-2">
              This will permanently remove the niche. Niches with associated
              reels cannot be deleted until all reels are removed.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDelete(deletingId)}
                disabled={deleteNiche.isPending}
              >
                {deleteNiche.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15">
              <Database className="h-5 w-5 text-studio-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-studio-fg">
                Niches Orchestration
              </h2>
              <p className="text-sm text-dim-2">
                Manage curated content categories and scrape jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-dim-2 hover:text-studio-fg"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Niche
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim-3 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search niches…"
              className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 pl-9 pr-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
            />
          </div>
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={cn(
              "h-10 px-4 rounded-xl text-base font-medium border transition-all",
              activeOnly
                ? "bg-studio-accent/10 border-studio-accent/40 text-studio-accent"
                : "bg-overlay-sm border-overlay-md text-dim-2 hover:border-overlay-lg"
            )}
          >
            Active Only
          </button>
        </div>

        <div className="rounded-2xl border border-overlay-sm overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_100px_100px_160px] text-sm font-semibold uppercase tracking-wider text-dim-3 bg-overlay-xs px-4 py-3 border-b border-overlay-sm">
            <span>#</span>
            <span>Name</span>
            <span>Status</span>
            <span>Reels</span>
            <span className="text-right">Actions</span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/[0.04]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="px-4 py-4 flex gap-4 items-center animate-pulse"
                >
                  <div className="h-4 w-8 bg-overlay-sm rounded" />
                  <div className="h-4 flex-1 bg-overlay-sm rounded" />
                  <div className="h-5 w-16 bg-overlay-sm rounded-full" />
                  <div className="h-4 w-12 bg-overlay-sm rounded" />
                  <div className="h-8 w-32 bg-overlay-sm rounded-lg ml-auto" />
                </div>
              ))}
            </div>
          ) : niches.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <Database className="h-10 w-10 text-dim-3" />
              <p className="text-base font-medium text-dim-3">No niches yet</p>
              <button
                onClick={() => setCreating(true)}
                className="text-sm text-studio-accent hover:underline"
              >
                Create your first niche
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {niches.map((niche) => (
                <div
                  key={niche.id}
                  className="grid grid-cols-[48px_1fr_100px_100px_160px] items-center px-4 py-3.5 hover:bg-overlay-xs transition-colors"
                >
                  <span className="text-sm text-dim-3 font-mono">
                    {niche.id}
                  </span>
                  <div>
                    <Link
                      to="/admin/niches/$nicheId"
                      params={{ nicheId: String(niche.id) }}
                      className="text-base font-medium text-studio-fg hover:text-studio-accent transition-colors truncate block"
                    >
                      {niche.name}
                    </Link>
                    {niche.description && (
                      <p className="text-sm text-dim-3 truncate mt-0.5">
                        {niche.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full",
                        niche.isActive
                          ? "bg-success/10 text-success"
                          : "bg-overlay-sm text-dim-3"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          niche.isActive ? "bg-success" : "bg-overlay-xs"
                        )}
                      />
                      {niche.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-base text-dim-1 tabular-nums">
                    {niche.reelCount.toLocaleString()}
                  </span>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-sm"
                      onClick={() => setEditing(niche)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-sm text-error hover:text-error hover:bg-error/10"
                      onClick={() => setDeletingId(niche.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {niches.length > 0 && (
          <p className="text-sm text-dim-3 text-right">
            {niches.length} niche{niches.length !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </>
  );
}
