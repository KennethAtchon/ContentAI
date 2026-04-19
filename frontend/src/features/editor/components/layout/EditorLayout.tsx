import type { EditProject } from "../../types/editor";
import { EditorProviders } from "./EditorProviders";
import { EditorHeader } from "./EditorHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorStatusBar } from "./EditorStatusBar";
import { TimelineSection } from "../timeline/TimelineSection";
import { EditorDialogs } from "../dialogs/EditorDialogs";

interface Props {
  project: EditProject;
  onBack: () => void;
}

export function EditorLayout({ project, onBack }: Props) {
  return (
    <EditorProviders project={project} onBack={onBack}>
      <div
        className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full"
        style={{ height: "100%" }}
      >
        <EditorHeader />
        <EditorWorkspace project={project} />
        <TimelineSection />
        <EditorStatusBar />
        <EditorDialogs />
      </div>
    </EditorProviders>
  );
}
