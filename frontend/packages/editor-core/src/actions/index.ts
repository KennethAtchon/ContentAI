/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Command validation, execution, serialization, undo, redo, and inverse-action generation for project edits.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export { ActionValidator } from "./action-validator";
export { ActionExecutor } from "./action-executor";
export {
  ActionHistory,
  type HistoryEntry,
  type ActionGroup,
  type HistorySnapshot,
} from "./action-history";
export { ActionSerializer } from "./action-serializer";
export { InverseActionGenerator } from "./inverse-action-generator";
