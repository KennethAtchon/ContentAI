import * as r2 from "./r2";
import { APP_ENV, R2_PUBLIC_URL } from "@/utils/config/envUtil";

const TESTING_PREFIX = "testing";

export interface StorageService {
  uploadFile(
    file: File | Buffer,
    path: string,
    contentType: string,
  ): Promise<string>;
  uploadFromUrl(
    url: string,
    key: string,
    fallbackContentType: string,
  ): Promise<string>;
  deleteFile(url: string): Promise<void>;
  getPublicUrl(path: string): string;
}

class R2Storage implements StorageService {
  async uploadFile(
    file: File | Buffer,
    path: string,
    contentType: string,
  ): Promise<string> {
    return r2.uploadFile(file, path, contentType);
  }

  async uploadFromUrl(
    url: string,
    key: string,
    fallbackContentType: string,
  ): Promise<string> {
    const res = await fetch(url, {
      headers: { "User-Agent": "ContentAI-Scraper/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Remote fetch failed (${res.status}): ${url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type")?.split(";")[0] ?? fallbackContentType;

    return r2.uploadFile(buffer, key, contentType);
  }

  async deleteFile(url: string): Promise<void> {
    const key = r2.extractKeyFromUrl(url);
    if (key) {
      await r2.deleteFile(key);
    }
  }

  getPublicUrl(path: string): string {
    const finalPath =
      APP_ENV === "development" ? `${TESTING_PREFIX}/${path}` : path;
    return `${R2_PUBLIC_URL}/${finalPath}`;
  }
}

// Export R2Storage as the only storage implementation
export const storage: StorageService = new R2Storage();

// Helper function to get storage instance (useful for testing or special cases)
export function getStorage(): StorageService {
  return new R2Storage();
}
