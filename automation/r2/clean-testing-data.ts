#!/usr/bin/env bun

/**
 * R2 Storage Cleaning Script
 * 
 * Cleans testing data from Cloudflare R2 storage.
 * In development mode, only deletes files with the 'testing/' prefix.
 * In production, requires explicit --production flag.
 */

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { loadEnv, requireEnv, promptConfirm, DRY_RUN } from "../shared/env";

loadEnv();

// R2 Configuration
const R2_ACCOUNT_ID = requireEnv("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");
const APP_ENV = requireEnv("APP_ENV");

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

interface ListResult {
  files: string[];
  hasMore: boolean;
  nextToken?: string;
}

async function listObjects(prefix: string, nextToken?: string): Promise<ListResult> {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
    ContinuationToken: nextToken,
    MaxKeys: 1000, // Process in batches of 1000
  });

  try {
    const response = await s3Client.send(command);
    return {
      files: response.Contents?.map(obj => obj.Key!).filter(Boolean) || [],
      hasMore: response.IsTruncated || false,
      nextToken: response.NextContinuationToken,
    };
  } catch (error) {
    console.error("Error listing objects:", error);
    throw new Error(`Failed to list objects with prefix '${prefix}'`);
  }
}

async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // Delete in batches of 1000 (AWS S3 limit)
  const batchSize = 1000;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    
    const command = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
        Quiet: false,
      },
    });

    try {
      const response = await s3Client.send(command);
      const deleted = response.Deleted?.length || 0;
      const failed = response.Errors?.length || 0;
      
      if (deleted > 0) {
        console.log(`✓ Deleted ${deleted} objects`);
      }
      
      if (failed > 0) {
        console.warn(`⚠ Failed to delete ${failed} objects:`);
        response.Errors?.forEach(error => {
          console.warn(`  - ${error.Key}: ${error.Message}`);
        });
      }
    } catch (error) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, error);
      throw new Error(`Failed to delete objects in batch ${i / batchSize + 1}`);
    }
  }
}

async function deleteSingleObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Deleted ${key}`);
  } catch (error) {
    console.error(`Error deleting ${key}:`, error);
    throw new Error(`Failed to delete object: ${key}`);
  }
}

async function getTestingFiles(): Promise<string[]> {
  const allFiles: string[] = [];
  let hasMore = true;
  let nextToken: string | undefined;

  console.log("Scanning for testing files...");

  while (hasMore) {
    const result = await listObjects("testing/", nextToken);
    allFiles.push(...result.files);
    hasMore = result.hasMore;
    nextToken = result.nextToken;
    
    if (result.files.length > 0) {
      console.log(`Found ${result.files.length} files (total: ${allFiles.length})`);
    }
  }

  return allFiles;
}

async function getAllFiles(): Promise<string[]> {
  const allFiles: string[] = [];
  let hasMore = true;
  let nextToken: string | undefined;

  console.log("Scanning all files in bucket...");

  while (hasMore) {
    const result = await listObjects("", nextToken);
    allFiles.push(...result.files);
    hasMore = result.hasMore;
    nextToken = result.nextToken;
    
    if (result.files.length > 0) {
      console.log(`Found ${result.files.length} files (total: ${allFiles.length})`);
    }
  }

  return allFiles;
}

async function main() {
  console.log(`🧹 R2 Storage Cleaner`);
  console.log(`Environment: ${APP_ENV}`);
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Dry run: ${DRY_RUN ? "YES" : "NO"}\n`);

  // Check if trying to run production cleanup
  const isProduction = APP_ENV === "production";
  const forceProduction = process.argv.includes("--production");

  if (isProduction && !forceProduction) {
    console.error("❌ This is a production environment!");
    console.error("   Use --production flag to confirm you want to delete production data.");
    process.exit(1);
  }

  if (!isProduction && forceProduction) {
    console.error("❌ --production flag can only be used in production environment");
    process.exit(1);
  }

  let filesToDelete: string[] = [];
  const deleteAll = process.argv.includes("--all");

  if (isProduction && forceProduction) {
    // Production mode with explicit flag
    filesToDelete = await getAllFiles();
    console.log(`🚨 PRODUCTION MODE - Will delete ALL ${filesToDelete.length} files in bucket!`);
  } else if (deleteAll) {
    // Development mode with --all flag
    filesToDelete = await getAllFiles();
    console.log(`🧹 Development mode - Will delete ALL ${filesToDelete.length} files in bucket!`);
  } else {
    // Default: only testing files
    filesToDelete = await getTestingFiles();
    console.log(`🧹 Development mode - Will delete ${filesToDelete.length} testing files`);
  }

  if (filesToDelete.length === 0) {
    console.log("✅ No files to delete");
    return;
  }

  // Show sample of files to be deleted
  const sampleSize = Math.min(10, filesToDelete.length);
  console.log(`\nSample files to be deleted:`);
  filesToDelete.slice(0, sampleSize).forEach(file => {
    console.log(`  - ${file}`);
  });
  
  if (filesToDelete.length > sampleSize) {
    console.log(`  ... and ${filesToDelete.length - sampleSize} more files`);
  }

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN - No files will be deleted");
    return;
  }

  // Confirmation prompt
  const confirmMessage = `Are you sure you want to delete ${filesToDelete.length} files from ${R2_BUCKET_NAME}?`;
  const confirmed = await promptConfirm(confirmMessage);
  
  if (!confirmed) {
    console.log("❌ Cancelled");
    return;
  }

  // Delete files
  console.log("\n🗑️ Deleting files...");
  const startTime = Date.now();

  try {
    await deleteObjects(filesToDelete);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Successfully deleted ${filesToDelete.length} files in ${duration}s`);
  } catch (error) {
    console.error("\n❌ Error during deletion:", error);
    process.exit(1);
  }
}

// Handle specific file deletion
if (process.argv.includes("--file")) {
  const fileIndex = process.argv.indexOf("--file");
  const fileName = process.argv[fileIndex + 1];
  
  if (!fileName) {
    console.error("❌ --file requires a file path");
    process.exit(1);
  }

  const key = APP_ENV === "development" && !fileName.startsWith("testing/") 
    ? `testing/${fileName}` 
    : fileName;

  console.log(`🗑️ Deleting single file: ${key}`);
  
  if (DRY_RUN) {
    console.log("🔍 DRY RUN - File will not be deleted");
  } else {
    const confirmed = await promptConfirm(`Delete file '${key}'?`);
    if (confirmed) {
      await deleteSingleObject(key);
      console.log("✅ File deleted");
    } else {
      console.log("❌ Cancelled");
    }
  }
  process.exit(0);
}

// Show help
if (process.argv.includes("--help")) {
  console.log(`
R2 Storage Cleaner

Usage:
  bun r2/clean-testing-data.ts [options]

Options:
  --dry-run          Show what would be deleted without actually deleting
  --confirm          Skip the confirmation prompt
  --all              Delete ALL files (not just testing files) in development
  --production       Required for production environment cleanup
  --file <path>      Delete a specific file
  --help             Show this help message

Examples:
  bun r2/clean-testing-data.ts                    # Delete testing files only
  bun r2/clean-testing-data.ts --dry-run         # Preview what would be deleted
  bun r2/clean-testing-data.ts --all --confirm   # Delete all files in development
  bun r2/clean-testing-data.ts --production      # Delete all files in production
  bun r2/clean-testing-data.ts --file test.mp4   # Delete specific file
`);
  process.exit(0);
}

main().catch(error => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
