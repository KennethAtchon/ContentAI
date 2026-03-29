import { useState, useRef } from "react";
import {
  Music,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Upload,
  Loader2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  useAdminMusicTracks,
  useUploadMusicTrack,
  useToggleMusicTrack,
  useDeleteMusicTrack,
  type AdminMusicTrack,
} from "@/features/admin/hooks/use-admin-music";
import { cn } from "@/shared/utils/helpers/utils";

const MOODS = ["energetic", "calm", "dramatic", "funny", "inspiring"] as const;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [mood, setMood] = useState<(typeof MOODS)[number]>("energetic");
  const [genre, setGenre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useUploadMusicTrack();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please select an MP3 file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("artistName", artistName);
    formData.append("mood", mood);
    formData.append("genre", genre);
    try {
      await upload.mutateAsync(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-studio-surface border border-overlay-md rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-overlay-sm">
          <h2 className="text-xl font-semibold text-studio-fg">Upload Track</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
              MP3 File <span className="text-error">*</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full bg-overlay-sm border border-dashed border-overlay-lg rounded-xl h-20 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-studio-accent/50 transition-colors"
            >
              {file ? (
                <>
                  <Upload className="h-4 w-4 text-studio-accent" />
                  <span className="text-sm text-studio-fg truncate max-w-[280px] px-4">
                    {file.name}
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-dim-3" />
                  <span className="text-sm text-dim-2">
                    Click to select MP3 (max 10MB)
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,.mp3"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
              Track Name <span className="text-error">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Sunset Drive"
              className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 px-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
              Artist Name
            </label>
            <input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="e.g. Audio Library"
              className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 px-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
                Mood <span className="text-error">*</span>
              </label>
              <select
                value={mood}
                onChange={(e) =>
                  setMood(e.target.value as (typeof MOODS)[number])
                }
                className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 px-3 text-base text-studio-fg outline-none focus:border-studio-accent/50 transition-colors"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m} className="bg-gray-900 capitalize">
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dim-1 uppercase tracking-wider">
                Genre
              </label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. lo-fi"
                className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 px-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
              />
            </div>
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
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Track
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  track,
  onConfirm,
  onCancel,
  isPending,
}: {
  track: AdminMusicTrack;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-studio-surface border border-overlay-md rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-studio-fg">Delete Track?</h3>
        <p className="text-base text-dim-2">
          This will permanently remove{" "}
          <strong className="text-studio-fg">{track.name}</strong> from the
          library. Existing user attachments will show "track unavailable".
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function MusicView() {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState<AdminMusicTrack | null>(
    null
  );

  const { data, isLoading, refetch } = useAdminMusicTracks(search || undefined);
  const toggleTrack = useToggleMusicTrack();
  const deleteTrack = useDeleteMusicTrack();

  const tracks = data?.tracks ?? [];

  const handleDelete = async () => {
    if (!deletingTrack) return;
    try {
      await deleteTrack.mutateAsync(deletingTrack.id);
    } finally {
      setDeletingTrack(null);
    }
  };

  const handleToggle = (track: AdminMusicTrack) => {
    toggleTrack.mutate({ id: track.id, isActive: !track.isActive });
  };

  return (
    <>
      {uploading && <UploadModal onClose={() => setUploading(false)} />}
      {deletingTrack && (
        <DeleteConfirm
          track={deletingTrack}
          onConfirm={handleDelete}
          onCancel={() => setDeletingTrack(null)}
          isPending={deleteTrack.isPending}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-studio-accent/15">
              <Music className="h-5 w-5 text-studio-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-studio-fg">
                Music Library
              </h2>
              <p className="text-sm text-dim-2">
                Upload and manage background music tracks for users
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
            <Button onClick={() => setUploading(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Upload Track
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim-3 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracks…"
            className="w-full bg-overlay-sm border border-overlay-md rounded-xl h-10 pl-9 pr-4 text-base text-studio-fg placeholder:text-dim-3 outline-none focus:border-studio-accent/50 transition-colors"
          />
        </div>

        <div className="rounded-2xl border border-overlay-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_80px_80px_120px_100px] text-sm font-semibold uppercase tracking-wider text-dim-3 bg-overlay-xs px-4 py-3 border-b border-overlay-sm">
            <span>Track</span>
            <span>Mood</span>
            <span>Genre</span>
            <span>Duration</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {isLoading ? (
            <div className="divide-y divide-white/[0.04]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="px-4 py-4 flex gap-4 items-center animate-pulse"
                >
                  <div className="h-4 flex-1 bg-overlay-sm rounded" />
                  <div className="h-5 w-20 bg-overlay-sm rounded-full" />
                  <div className="h-4 w-16 bg-overlay-sm rounded" />
                  <div className="h-4 w-12 bg-overlay-sm rounded" />
                  <div className="h-5 w-16 bg-overlay-sm rounded-full" />
                  <div className="h-8 w-24 bg-overlay-sm rounded-lg ml-auto" />
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <Music className="h-10 w-10 text-dim-3" />
              <p className="text-base font-medium text-dim-3">
                {search ? "No tracks match your search" : "No music tracks yet"}
              </p>
              {!search && (
                <button
                  onClick={() => setUploading(true)}
                  className="text-sm text-studio-accent hover:underline"
                >
                  Upload your first track
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="grid grid-cols-[1fr_120px_80px_80px_120px_100px] items-center px-4 py-3.5 hover:bg-overlay-xs transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium text-studio-fg truncate">
                      {track.name}
                    </p>
                    {track.artistName && (
                      <p className="text-sm text-dim-2 truncate mt-0.5">
                        {track.artistName}
                      </p>
                    )}
                  </div>

                  <span className="text-sm text-dim-1 capitalize">
                    {track.mood}
                  </span>

                  <span className="text-sm text-dim-2">
                    {track.genre || "—"}
                  </span>

                  <span className="text-sm text-dim-1 tabular-nums">
                    {formatDuration(track.durationSeconds)}
                  </span>

                  <div>
                    <button
                      onClick={() => handleToggle(track)}
                      disabled={toggleTrack.isPending}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full transition-colors",
                        track.isActive
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : "bg-overlay-sm text-dim-3 hover:bg-overlay-md"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          track.isActive ? "bg-success" : "bg-overlay-xs"
                        )}
                      />
                      {track.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-error hover:text-error hover:bg-error/10"
                      onClick={() => setDeletingTrack(track)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {tracks.length > 0 && (
          <p className="text-sm text-dim-3 text-right">
            {tracks.length} track{tracks.length !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </>
  );
}
