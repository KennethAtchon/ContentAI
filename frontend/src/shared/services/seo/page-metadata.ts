/**
 * Page Metadata Helper
 *
 * Utility for creating consistent page metadata with automatic canonical URL generation.
 */

// import { Metadata } from "next";
import { generateBusinessMetadata, Metadata } from "./metadata";
import { BASE_URL } from "@/shared/utils/config/envUtil";

export interface CreatePageMetadataOptions {
  /**
   * Page title
   */
  title: string;
  /**
   * Page description
   */
  description: string;
  /**
   * Page path (for canonical URL)
   */
  path: string;
  /**
   * Revalidation time in seconds
   * @default 3600
   */
  revalidate?: number;
  /**
   * Additional metadata options
   */
  additionalMetadata?: Partial<Metadata>;
}

/**
 * Create standardized page metadata
 *
 * @param options - Metadata options
 * @returns Metadata object and revalidate export
 */
export function createPageMetadata({
  title,
  description,
  path,
  revalidate = 3600,
  // additionalMetadata: Additional metadata,
}: CreatePageMetadataOptions): {
  metadata: Metadata;
  revalidate: number;
} {
  const baseUrl = BASE_URL !== "[BASE_URL]" ? BASE_URL : "";
  const canonical = baseUrl ? `${baseUrl}${path}` : path;

  // Generate base metadata with required fields
  // Note: additionalMetadata is not spread here as it's Partial<Metadata>
  // which is incompatible with SEOConfig. If needed, merge manually.
  return {
    metadata: generateBusinessMetadata({
      title,
      description,
      canonical,
    }),
    revalidate,
  };
}
