import type { EditProject } from "../../model/editor";
import { Inspector } from "../inspector/Inspector";
import { LeftPanel } from "../panels/LeftPanel";
import { PreviewArea } from "../preview/PreviewArea";

interface EditorWorkspaceProps {
  project: EditProject;
}

export function EditorWorkspace({ project }: EditorWorkspaceProps) {
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <LeftPanel generatedContentId={project.generatedContentId} />
      <PreviewArea
        resolution={project.resolution}
        durationMs={project.durationMs}
      />
      <Inspector />
    </div>
  );
}
