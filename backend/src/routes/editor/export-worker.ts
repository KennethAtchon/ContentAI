import {
  editorRepository,
  assetsRepository,
} from "../../domain/singletons";
import { runExportJob as runExportJobCore } from "../../domain/editor/run-export-job";

/**
 * FFmpeg export pipeline — DB access via repositories; core logic in
 * `domain/editor/run-export-job.ts`.
 */
export async function runExportJob(
  jobId: string,
  project: {
    id: string;
    projectDocument: unknown;
    durationMs: number;
    fps: number;
    resolution: string;
  },
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  return runExportJobCore(jobId, project, userId, opts, {
    updateExportJob: (id, p) => editorRepository.updateExportJob(id, p),
    findManyAssetsByIdsForUser: (uid, ids) =>
      assetsRepository.findManyByIdsForUser(uid, ids),
    insertAssembledVideoAsset: (row) => assetsRepository.insertAsset(row),
  });
}
