/**
 * Clear Firestore Customer Data
 *
 * Deletes all documents in the Firestore `customers` collection, including
 * every subcollection (subscriptions, payments, checkout_sessions).
 *
 * This removes all data synced by the Firebase Stripe Payments extension.
 * The Stripe side is NOT touched — use stripe/cancel-subscriptions.ts first
 * if you want to cancel subscriptions before clearing Firestore.
 *
 * Usage:
 *   bun firebase/clear-customers.ts                  # all customers
 *   bun firebase/clear-customers.ts --uid <firebaseUid>  # specific user only
 *   bun firebase/clear-customers.ts --dry-run        # preview without deleting
 *   bun firebase/clear-customers.ts --confirm        # skip confirmation prompt
 */

import { loadEnv, requireEnv, promptConfirm, DRY_RUN } from "../shared/env.ts";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv();

const TARGET_UID = (() => {
  const idx = process.argv.indexOf("--uid");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const SUBCOLLECTIONS = ["subscriptions", "payments", "checkout_sessions"];

function initFirebase(): FirebaseFirestore.Firestore {
  if (getApps().length === 0) {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

async function deleteSubcollections(
  db: FirebaseFirestore.Firestore,
  customerRef: FirebaseFirestore.DocumentReference,
): Promise<number> {
  let deleted = 0;
  for (const sub of SUBCOLLECTIONS) {
    const snapshot = await customerRef.collection(sub).get();
    for (const doc of snapshot.docs) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would delete ${customerRef.id}/${sub}/${doc.id}`);
      } else {
        await doc.ref.delete();
        console.log(`  Deleted ${customerRef.id}/${sub}/${doc.id}`);
      }
      deleted++;
    }
  }
  return deleted;
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

  const db = initFirebase();

  let customerDocs: FirebaseFirestore.QueryDocumentSnapshot[];

  if (TARGET_UID) {
    const doc = await db.collection("customers").doc(TARGET_UID).get();
    if (!doc.exists) {
      console.log(`No customer document found for uid: ${TARGET_UID}`);
      return;
    }
    customerDocs = [doc as FirebaseFirestore.QueryDocumentSnapshot];
    console.log(`Targeting single customer: ${TARGET_UID}\n`);
  } else {
    const snapshot = await db.collection("customers").get();
    customerDocs = snapshot.docs;
    console.log(`Found ${customerDocs.length} customer document(s)\n`);
  }

  if (customerDocs.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!DRY_RUN) {
    const scope = TARGET_UID
      ? `customer ${TARGET_UID}`
      : `all ${customerDocs.length} customer(s)`;
    const confirmed = await promptConfirm(
      `Delete ALL Firestore customer data for ${scope}?\n` +
        "This removes subscriptions, payments, and checkout sessions from Firestore.",
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  let totalDocs = 0;
  let totalCustomers = 0;

  for (const customerDoc of customerDocs) {
    const ref = customerDoc.ref;
    console.log(`\nProcessing customer: ${ref.id}`);

    const subCount = await deleteSubcollections(db, ref);

    // Delete the customer document itself
    if (DRY_RUN) {
      console.log(`  [dry-run] Would delete customers/${ref.id}`);
    } else {
      await ref.delete();
      console.log(`  Deleted customers/${ref.id}`);
    }

    totalDocs += subCount + 1;
    totalCustomers++;
  }

  console.log(
    `\n${DRY_RUN ? "Would have deleted" : "Deleted"} ${totalDocs} document(s) across ${totalCustomers} customer(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
