import { useTranslation } from "react-i18next";
import { Trash2, Video, Music, ImageIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { MediaItem } from "../types/media.types";

interface Props {
  item: MediaItem;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TypeIcon({ type }: { type: MediaItem["type"] }) {
  if (type === "video") return <Video className="w-5 h-5" />;
  if (type === "audio") return <Music className="w-5 h-5" />;
  return <ImageIcon className="w-5 h-5" />;
}

export function MediaItemCard({ item, onDelete, isDeleting }: Props) {
  const { t } = useTranslation();

  return (
    <div className="group relative rounded-lg overflow-hidden border border-border bg-card hover:border-primary/40 transition-colors">
      {/* Thumbnail / preview */}
      <div className="aspect-video bg-muted flex items-center justify-center relative">
        {item.type === "video" && item.mediaUrl ? (
          <video
            src={item.mediaUrl}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <span className="text-muted-foreground">
            <TypeIcon type={item.type} />
          </span>
        )}

        {/* Delete button on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            size="icon"
            variant="destructive"
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            aria-label={t("media_library_delete")}
            className="w-8 h-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium truncate text-foreground">
          {item.name}
        </p>
        {item.sizeBytes && (
          <p className="text-[10px] text-muted-foreground">
            {formatBytes(item.sizeBytes)}
          </p>
        )}
      </div>
    </div>
  );
}
