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
        <EditorHeader
          title={project.title ?? "Untitled Edit"}
          isReadOnly={project.status === "published"}
          onBack={onBack}
        />
        <EditorWorkspace project={project} />
        <TimelineSection />
        <EditorStatusBar
          clipCount={project.tracks.reduce((count, track) => count + track.clips.length, 0)}
          trackCount={project.tracks.length}
          resolution={project.resolution}
          fps={project.fps}
        />
        <EditorDialogs />
      </div>
    </EditorProviders>
  );
}
