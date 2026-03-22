import { createContext, useContext } from "react";

/** Maps assetId → resolved URL (signed R2 URL or CDN URL). */
export const AssetUrlMapContext = createContext<Map<string, string>>(new Map());

export function useAssetUrlMap(): Map<string, string> {
  return useContext(AssetUrlMapContext);
}
