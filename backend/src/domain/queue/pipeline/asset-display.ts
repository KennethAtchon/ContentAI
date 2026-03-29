/**
 * Maps content_asset.role to the `type` field the studio queue detail UI expects.
 */
export function queueDetailAssetType(role: string): string {
  if (role === "background_music") return "music";
  return role;
}
