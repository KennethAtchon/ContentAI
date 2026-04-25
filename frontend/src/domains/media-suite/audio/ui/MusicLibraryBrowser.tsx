import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Music, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/primitives/sheet";
import { Input } from "@/shared/ui/primitives/input";
import { useMusicLibrary } from "../hooks/use-music-library";
import { MusicTrackRow } from "./MusicTrackRow";
import type { MusicTrack, MusicLibraryFilters } from "../model/audio.types";

interface MusicLibraryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrack: (track: MusicTrack) => void;
  currentTrackId?: string;
}

const MOOD_FILTERS = [
  "energetic",
  "calm",
  "dramatic",
  "funny",
  "inspiring",
] as const;

const DURATION_FILTERS = [
  { label: "15s", value: "15" },
  { label: "30s", value: "30" },
  { label: "60s", value: "60" },
] as const;

export function MusicLibraryBrowser({
  open,
  onOpenChange,
  onSelectTrack,
  currentTrackId,
}: MusicLibraryBrowserProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<MusicLibraryFilters>({});

  const { data, isLoading, isError, refetch } = useMusicLibrary(filters);
  const tracks = data?.tracks ?? [];

  const clearFilters = () => setFilters({});
  const hasFilters = !!(
    filters.search ||
    filters.mood ||
    filters.durationBucket
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-base">
            {t("audio_music_libraryTitle")}
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pt-3 pb-2 flex flex-col gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t("audio_music_search")}
              value={filters.search ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  search: e.target.value || undefined,
                }))
              }
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {MOOD_FILTERS.map((mood) => (
              <button
                key={mood}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    mood: f.mood === mood ? undefined : mood,
                  }))
                }
                className={`text-sm px-2 py-0.5 rounded-full border transition-colors capitalize ${
                  filters.mood === mood
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {t(`audio_mood_${mood}`)}
              </button>
            ))}
            {DURATION_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    durationBucket:
                      f.durationBucket === value ? undefined : value,
                  }))
                }
                className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                  filters.durationBucket === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t" />

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex flex-col gap-2 pt-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-base text-muted-foreground">
                {t("audio_music_loadError")}
              </p>
              <button
                onClick={() => void refetch()}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                {t("audio_voices_retry")}
              </button>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Music className="w-12 h-12 text-muted-foreground/30" />
              {hasFilters ? (
                <>
                  <p className="text-base text-muted-foreground">
                    {t("audio_music_noResults")}
                  </p>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    {t("audio_music_clearFilters")}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-medium">
                    {t("audio_music_emptyTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    {t("audio_music_emptySubtitle")}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="py-1">
              {tracks.map((track) => (
                <MusicTrackRow
                  key={track.id}
                  track={track}
                  isSelected={currentTrackId === track.id}
                  onSelect={() => {
                    onSelectTrack(track);
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
