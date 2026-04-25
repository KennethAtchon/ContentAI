import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  InspectorSection,
  InspectorPropRow,
} from "../inspector/InspectorPrimitives";
import type { CaptionDoc } from "../../model/caption";

interface Props {
  doc: CaptionDoc | null | undefined;
  isSaving?: boolean;
  onSave: (input: Pick<CaptionDoc, "tokens" | "fullText" | "language">) => void;
}

export function CaptionTranscriptEditor({ doc, isSaving, onSave }: Props) {
  const { t } = useTranslation();
  const [fullText, setFullText] = useState(doc?.fullText ?? "");
  const [draftDocId, setDraftDocId] = useState<string | null>(
    doc?.captionDocId ?? null
  );
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (
      draftDocId &&
      doc?.captionDocId &&
      draftDocId !== doc.captionDocId &&
      isDirty
    ) {
      toast.error(
        "Save or discard your transcript edits before switching clips."
      );
      return;
    }
    if (draftDocId === doc?.captionDocId && isDirty) {
      return;
    }
    setDraftDocId(doc?.captionDocId ?? null);
    setFullText(doc?.fullText ?? "");
    setIsDirty(false);
  }, [doc?.captionDocId, doc?.fullText, draftDocId]);

  return (
    <InspectorSection title={t("editor_caption_transcript_title")}>
      <textarea
        className="w-full rounded border border-overlay-sm bg-overlay-sm px-2 py-1.5 text-xs text-dim-1 resize-none"
        rows={5}
        value={fullText}
        onChange={(e) => {
          setFullText(e.target.value);
          setIsDirty(true);
        }}
        placeholder={t("editor_caption_transcript_placeholder")}
      />
      <InspectorPropRow label={t("editor_caption_save_label")}>
        <button
          type="button"
          disabled={!doc || isSaving}
          title={
            !doc
              ? "Select a caption clip first."
              : isSaving
                ? t("editor_caption_saving")
                : t("editor_caption_save")
          }
          onClick={() => {
            if (!doc) return;
            onSave({
              tokens: doc.tokens,
              fullText,
              language: doc.language,
            });
            setIsDirty(false);
          }}
          className="rounded border border-studio-accent px-2 py-1 text-[10px] text-studio-accent disabled:opacity-50"
        >
          {isSaving ? t("editor_caption_saving") : t("editor_caption_save")}
        </button>
      </InspectorPropRow>
    </InspectorSection>
  );
}
