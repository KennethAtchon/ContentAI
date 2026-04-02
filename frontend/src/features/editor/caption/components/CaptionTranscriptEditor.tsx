import { useEffect, useState } from "react";
import {
  InspectorSection,
  InspectorPropRow,
} from "../../components/inspector/InspectorPrimitives";
import type { CaptionDoc } from "../types";

interface Props {
  doc: CaptionDoc | null | undefined;
  isSaving?: boolean;
  onSave: (input: Pick<CaptionDoc, "tokens" | "fullText" | "language">) => void;
}

export function CaptionTranscriptEditor({ doc, isSaving, onSave }: Props) {
  const [fullText, setFullText] = useState(doc?.fullText ?? "");

  useEffect(() => {
    setFullText(doc?.fullText ?? "");
  }, [doc?.captionDocId, doc?.fullText]);

  return (
    <InspectorSection title="Transcript">
      <textarea
        className="w-full rounded border border-overlay-sm bg-overlay-sm px-2 py-1.5 text-xs text-dim-1 resize-none"
        rows={5}
        value={fullText}
        onChange={(e) => setFullText(e.target.value)}
        placeholder="Edit transcript text"
      />
      <InspectorPropRow label="Save">
        <button
          type="button"
          disabled={!doc || isSaving}
          onClick={() =>
            doc &&
            onSave({
              tokens: doc.tokens,
              fullText,
              language: doc.language,
            })
          }
          className="rounded border border-studio-accent px-2 py-1 text-[10px] text-studio-accent disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </InspectorPropRow>
    </InspectorSection>
  );
}
