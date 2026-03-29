import type { IAssetsRepository, NewUploadedAsset } from "./assets.repository";

export class AssetsService {
  constructor(private readonly assets: IAssetsRepository) {}

  listUserLibrary(userId: string) {
    return this.assets.listUploadedByUserId(userId);
  }

  createUploadedAsset(row: NewUploadedAsset) {
    return this.assets.insertUploaded(row);
  }

  getUploadedAsset(userId: string, id: string) {
    return this.assets.findUploadedByUserAndId(userId, id);
  }

  removeById(id: string) {
    return this.assets.deleteById(id);
  }

  updateMetadata(userId: string, assetId: string, metadata: Record<string, unknown>) {
    return this.assets.updateMetadata(assetId, userId, metadata);
  }

  getR2KeyForAsset(userId: string, assetId: string) {
    return this.assets.findR2KeyByIdAndUserId(assetId, userId);
  }
}
