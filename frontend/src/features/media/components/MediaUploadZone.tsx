import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useUploadMedia } from "../hooks/use-media-library";

interface Props {
  onUploaded?: () => void;
  compact?: boolean;
}

export function MediaUploadZone({ onUploaded, compact }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const upload = useUploadMedia();

  async function handleFiles(files: HTMLInputElement["files"]) {
    if (!files || files.length === 0) return;
    const file = files[0];
    await upload.mutateAsync({ file });
    onUploaded?.();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(
      e.dataTransfer.files as unknown as HTMLInputElement["files"]
    );
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/mp4,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {upload.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {upload.isPending
            ? t("media_library_uploading")
            : t("editor_media_upload")}
        </button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/mp4,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {upload.isPending ? (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      ) : (
        <Upload className="w-8 h-8 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground text-center">
        {upload.isPending
          ? t("media_library_uploading")
          : t("media_library_upload")}
      </p>
    </div>
  );
}
