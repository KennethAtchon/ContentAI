/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Project serialization, schema definitions, persistent storage, and cache management.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export * from "./types";
export * from "./storage-engine";
export * from "./cache-manager";
export * from "./project-serializer";
