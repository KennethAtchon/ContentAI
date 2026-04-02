import { AppError } from "../../utils/errors/app-error";
import { editorStoredTracksSchema } from "./editor.schemas";
import type { EditorTracks } from "../../types/timeline.types";

/**
 * Parse and validate `edit_projects.tracks` JSONB when serving a project to the client.
 * Throws {@link AppError} with code `INVALID_TIMELINE` if the stored value is corrupt.
 */
export function parseStoredEditorTracks(raw: unknown): EditorTracks {
  if (raw == null) {
    return [];
  }
  const parsed = editorStoredTracksSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "Stored timeline failed validation",
      "INVALID_TIMELINE",
      422,
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}
