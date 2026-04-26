import { EditorHeader } from "./EditorHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorStatusBar } from "./EditorStatusBar";
import { TimelineSection } from "../timeline/TimelineSection";
import { ExportModal } from "../dialogs/ExportModal";

interface Props {
  onBack: () => void;
}

export function EditorLayout({ onBack }: Props) {
  return (
    <div
      className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full"
      style={{ height: "100%" }}
    >
      <EditorHeader onBack={onBack} />
      <EditorWorkspace />
      <TimelineSection />
      <EditorStatusBar />
      <ExportModal />
    </div>
  );
}
