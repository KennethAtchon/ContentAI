import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useMediaLibrary, useDeleteMedia } from "../hooks/use-media-library";
import { MediaItemCard } from "./MediaItemCard";
import { MediaUploadZone } from "./MediaUploadZone";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaLibraryModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useMediaLibrary();
  const deleteMedia = useDeleteMedia();

  const items = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("media_library_title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          <MediaUploadZone />

          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("media_library_uploading")}
            </p>
          )}

          {!isLoading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("media_library_empty")}
            </p>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => (
                <MediaItemCard
                  key={item.id}
                  item={item}
                  onDelete={(id) => deleteMedia.mutate(id)}
                  isDeleting={
                    deleteMedia.isPending && deleteMedia.variables === item.id
                  }
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
