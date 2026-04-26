import { Inspector } from "../inspector/Inspector";
import { LeftPanel } from "../panels/LeftPanel";
import { PreviewArea } from "../preview/PreviewArea";

export function EditorWorkspace() {
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <LeftPanel />
      <PreviewArea />
      <Inspector />
    </div>
  );
}
