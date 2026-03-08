/**
 * Delete Firebase Auth Users
 *
 * Lists and deletes all users from Firebase Authentication.
 * Useful for a complete dev environment reset.
 *
 * Does NOT touch Firestore or the Postgres `users` table.
 * After running this, also run:
 *   bun firebase/clear-customers.ts   — clear Firestore customer data
 *   bun db:migrate (in backend/)      — or db-reset-and-migrate.sh to reset Postgres
 *
 * Usage:
 *   bun firebase/clear-users.ts                  # delete all users
 *   bun firebase/clear-users.ts --dry-run        # preview without deleting
 *   bun firebase/clear-users.ts --confirm        # skip confirmation prompt
 *   bun firebase/clear-users.ts --exclude-admins # skip users with admin custom claim
 */

import { loadEnv, requireEnv, promptConfirm, DRY_RUN } from "../shared/env.ts";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

loadEnv();

const EXCLUDE_ADMINS = process.argv.includes("--exclude-admins");

function initFirebase() {
  if (getApps().length === 0) {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getAuth();
}

async function listAllUsers(
  auth: ReturnType<typeof getAuth>,
): Promise<import("firebase-admin/auth").UserRecord[]> {
  const users: import("firebase-admin/auth").UserRecord[] = [];
  let pageToken: string | undefined;

  while (true) {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
    if (!pageToken) break;
  }

  return users;
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

  const auth = initFirebase();

  console.log("Listing Firebase Auth users...");
  const allUsers = await listAllUsers(auth);
  console.log(`Found ${allUsers.length} user(s)\n`);

  if (allUsers.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  let targets = allUsers;

  if (EXCLUDE_ADMINS) {
    targets = allUsers.filter(
      (u) => (u.customClaims as any)?.role !== "admin",
    );
    const excluded = allUsers.length - targets.length;
    if (excluded > 0) {
      console.log(`Skipping ${excluded} admin user(s) (--exclude-admins)\n`);
    }
  }

  if (targets.length === 0) {
    console.log("No users to delete after applying filters.");
    return;
  }

  console.log("Users to delete:");
  for (const u of targets) {
    console.log(`  ${u.uid}  ${u.email || "(no email)"}`);
  }

  if (!DRY_RUN) {
    const confirmed = await promptConfirm(
      `Permanently delete ${targets.length} Firebase Auth user(s)?`,
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  // Firebase Admin deleteUsers supports up to 1000 at a time
  const BATCH_SIZE = 1000;
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const uids = batch.map((u) => u.uid);

    if (DRY_RUN) {
      console.log(`\n[dry-run] Would delete batch of ${uids.length} users`);
      deletedCount += uids.length;
    } else {
      try {
        const result = await auth.deleteUsers(uids);
        deletedCount += result.successCount;
        errorCount += result.failureCount;

        console.log(`\nDeleted batch: ${result.successCount} ok, ${result.failureCount} failed`);

        for (const err of result.errors) {
          console.error(
            `  Failed uid[${err.index}] ${uids[err.index]}: ${err.error.message}`,
          );
        }
      } catch (err: any) {
        console.error(`Batch delete failed: ${err.message}`);
        errorCount += batch.length;
      }
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would have deleted" : "Deleted"} ${deletedCount} user(s)` +
      (errorCount > 0 ? `, ${errorCount} error(s)` : "") +
      ".\n\nNext steps:",
  );
  console.log("  1. bun firebase/clear-customers.ts  — clear Firestore customer data");
  console.log("  2. cd backend && bun db:migrate      — or run db-reset-and-migrate.sh");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
