/**
 * GDPR Data Purge Script
 *
 * Permanently anonymises or deletes all personal data for users who have
 * requested account deletion (isDeleted = true) and whose deletion date is
 * older than the configured retention window.
 *
 * What it does per user:
 *   1. Overwrites PII fields in Postgres (name, email, phone, address, notes)
 *      with deterministic placeholder values so FK constraints are satisfied.
 *   2. Deletes the user's FeatureUsage rows (contains input data).
 *   3. Soft-deletes any remaining Orders (sets isDeleted = true / deletedBy = "gdpr").
 *   4. Deletes the Firestore "customers/{uid}" document tree (subscriptions,
 *      payments, checkout_sessions).
 *   5. Deletes the Firebase Auth account if a UID exists.
 *   6. Marks the Postgres user row with a "purged" flag so this script is
 *      idempotent (re-running will not attempt to re-purge already-purged rows).
 *
 * Usage:
 *   bun scripts/gdpr-data-purge.ts
 *   bun scripts/gdpr-data-purge.ts --dry-run   # print affected users, no changes
 *   bun scripts/gdpr-data-purge.ts --days 30   # override retention window (default: 30)
 */

import { db, gracefulShutdown } from "../src/services/db/db";
import {
  users,
  orders,
  featureUsages,
} from "../src/infrastructure/database/drizzle/schema";
import { and, eq, lte, isNotNull, ne, sql } from "drizzle-orm";
import { adminAuth, adminDb } from "../src/services/firebase/admin";

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_RETENTION_DAYS = 30;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const daysArg =
  args.find((a) => a.startsWith("--days=")) ?? args[args.indexOf("--days") + 1];
const RETENTION_DAYS =
  daysArg && !isNaN(Number(daysArg)) ? Number(daysArg) : DEFAULT_RETENTION_DAYS;

const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function anonymisedEmail(id: string): string {
  return `purged-${id}@gdpr.invalid`;
}

async function purgeFirestore(uid: string): Promise<void> {
  const customerRef = adminDb.collection("customers").doc(uid);
  const subCollections = ["subscriptions", "payments", "checkout_sessions"];

  for (const col of subCollections) {
    const snap = await customerRef.collection(col).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  }

  await customerRef.delete();
}

async function purgeFirebaseAuth(uid: string): Promise<void> {
  try {
    await adminAuth.deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") throw err;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────");
  console.log(" GDPR Data Purge");
  console.log(
    ` Retention: ${RETENTION_DAYS} days (cutoff: ${cutoff.toISOString()})`,
  );
  console.log(` Mode:      ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("─────────────────────────────────────────\n");

  const userRows = await db
    .select({
      id: users.id,
      firebaseUid: users.firebaseUid,
      name: users.name,
      email: users.email,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.isDeleted, true),
        lte(users.deletedAt, cutoff),
        ne(users.name, "GDPR_PURGED"),
      ),
    );

  if (userRows.length === 0) {
    console.log("No users eligible for purge.");
    return;
  }

  console.log(`Found ${userRows.length} user(s) eligible for purge:\n`);
  for (const u of userRows) {
    console.log(
      `  • ${u.id} | deleted: ${u.deletedAt?.toISOString()} | firebase: ${u.firebaseUid ?? "none"}`,
    );
  }
  console.log();

  if (DRY_RUN) {
    console.log("Dry-run complete — no data was modified.");
    return;
  }

  let purged = 0;
  let failed = 0;

  for (const user of userRows) {
    try {
      console.log(`Purging ${user.id} …`);

      // 1. Delete FeatureUsage rows
      await db.delete(featureUsages).where(eq(featureUsages.userId, user.id));

      // 2. Soft-delete remaining orders
      await db
        .update(orders)
        .set({ isDeleted: true, deletedAt: new Date(), deletedBy: "gdpr" })
        .where(and(eq(orders.userId, user.id), eq(orders.isDeleted, false)));

      // 3. Anonymise Postgres PII
      await db
        .update(users)
        .set({
          name: "GDPR_PURGED",
          email: anonymisedEmail(user.id),
          phone: null,
          address: null,
          notes: null,
          firebaseUid: null,
        })
        .where(eq(users.id, user.id));

      // 4. Purge Firestore
      if (user.firebaseUid) {
        await purgeFirestore(user.firebaseUid);
        await purgeFirebaseAuth(user.firebaseUid);
      }

      console.log(`  ✓ Done`);
      purged++;
    } catch (err) {
      console.error(`  ✗ Failed for ${user.id}:`, err);
      failed++;
    }
  }

  console.log(`\nPurge complete. Purged: ${purged}, Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => gracefulShutdown());
