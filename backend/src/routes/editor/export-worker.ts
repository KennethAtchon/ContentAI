import {
  editorRepository,
  assetsRepository,
} from "../../domain/singletons";
import { runExportJob as runExportJobCore } from "../../domain/editor/run-export-job";

export async function runExportJob(
  jobId: string,
  revisionId: string,
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  return runExportJobCore(jobId, revisionId, userId, opts, {
    updateExportJob: (id, p) => editorRepository.updateExportJob(id, p),
    loadRevisionDocument: (rid) => editorRepository.findRevisionById(rid, userId),
    findManyAssetsByIdsForUser: (uid, ids) =>
      assetsRepository.findManyByIdsForUser(uid, ids),
    insertAssembledVideoAsset: (row) => assetsRepository.insertAsset(row),
  });
}
