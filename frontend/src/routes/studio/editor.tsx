import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EditorRoutePage } from "@/features/editor/components/EditorRoutePage";

function parseEditorSearch(search: Record<string, unknown>) {
  const rawPid = search.projectId;
  const projectParsed =
    typeof rawPid === "string"
      ? z.string().uuid().safeParse(rawPid)
      : { success: false as const };
  const projectId = projectParsed.success ? projectParsed.data : undefined;

  const contentParsed = z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .safeParse(search.contentId);
  const contentId = contentParsed.success ? contentParsed.data : undefined;

  return { projectId, contentId };
}

function EditorRouteComponent() {
  const search = Route.useSearch();
  return <EditorRoutePage search={search} />;
}

export const Route = createFileRoute("/studio/editor")({
  validateSearch: (search: Record<string, unknown>) => parseEditorSearch(search),
  component: EditorRouteComponent,
});

