/**
 * @fileoverview declares persisted storage schema shapes.
 *
 * Folder role: Project serialization, schema definitions, persistent storage, and cache management.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingAssets?: string[];
}

export interface ProjectFileWithMetadata {
  version: string;
  project: any;
  metadata?: {
    exportedAt: number;
    description?: string;
  };
}
