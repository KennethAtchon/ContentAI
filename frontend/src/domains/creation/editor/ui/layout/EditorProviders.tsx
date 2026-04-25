import type { ReactNode } from "react";
import type { EditProject } from "../../model/editor";

interface EditorProvidersProps {
  project: EditProject;
  onBack: () => void;
  children: ReactNode;
}

export function EditorProviders({ children }: EditorProvidersProps) {
  return <>{children}</>;
}
