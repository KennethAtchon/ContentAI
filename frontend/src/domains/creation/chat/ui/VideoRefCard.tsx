import { useTranslation } from "react-i18next";
import { Video, X } from "lucide-react";
import type { MediaItem } from "@/domains/media/model/media.types";

interface Props {
  item: MediaItem;
  onRemove: (id: string) => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoRefCard({ item, onRemove }: Props) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm max-w-[220px]">
      <Video className="w-3.5 h-3.5 shrink-0 text-primary/70" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{item.name}</p>
        {item.sizeBytes && (
          <p className="text-xs text-muted-foreground">
            {formatBytes(item.sizeBytes)}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label={t("media_library_delete")}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
