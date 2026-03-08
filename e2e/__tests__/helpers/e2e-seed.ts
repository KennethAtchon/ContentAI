/**
 * E2E Test User Seed Script
 *
 * Creates the Firebase + Postgres accounts needed by the E2E test suite.
 * Safe to run multiple times — existing users are updated, not duplicated.
 *
 * Run standalone:
 *   bun __tests__/helpers/e2e-seed.ts
 *
 * Or via package.json script:
 *   bun test:e2e:seed
 *
 * Requires the same env vars as the app (.env.local):
 *   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   DATABASE_URL
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { db } from "../../../backend/src/services/db/db.js";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

// Load environment variables - check for container environment first, then local files
if (process.env.DATABASE_URL?.includes('postgres')) {
  // Running in Docker container - environment already loaded
  console.log("[e2e-seed] Running in container environment");
} else {
  // Running locally - load from backend env file
  const backendEnvPath = path.resolve(process.cwd(), "..", "backend", ".env");
  
  if (fs.existsSync(backendEnvPath)) {
    console.log("[e2e-seed] Loading from backend .env");
    config({ path: backendEnvPath });
  } else {
    console.log("[e2e-seed] No backend .env found, using process.env");
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TEST_USERS = [
  {
    email: process.env.E2E_USER_EMAIL ?? "e2e-user@test.example.com",
    password: process.env.E2E_USER_PASSWORD ?? "TestPassword123!",
    name: "E2E Test User",
    role: "user" as const,
  },
  {
    email: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@test.example.com",
    password: process.env.E2E_ADMIN_PASSWORD ?? "TestPassword123!",
    name: "E2E Admin User",
    role: "admin" as const,
  },
];

// ─── Firebase Admin init ─────────────────────────────────────────────────────

function initFirebaseAdmin() {
  if (getApps().length > 0) return getAuth();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ).trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars.\n" +
        "Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local"
    );
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getAuth();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertFirebaseUser(
  auth: ReturnType<typeof getAuth>,
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName });
    console.log(
      `  [firebase] Updated existing user: ${email} (uid: ${existing.uid})`
    );
    return existing.uid;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "auth/user-not-found") {
      const created = await auth.createUser({ email, password, displayName });
      console.log(
        `  [firebase] Created new user: ${email} (uid: ${created.uid})`
      );
      return created.uid;
    }
    throw err;
  }
}

async function upsertDrizzleUser(
  db: any,
  firebaseUid: string,
  email: string,
  name: string,
  role: "user" | "admin"
) {
  const { users } = await import("../../../backend/src/infrastructure/database/drizzle/schema.js");
  
  await db.insert(users).values({
    firebaseUid,
    email,
    name,
    role,
    isActive: true,
  }).onConflictDoUpdate({
    target: users.firebaseUid,
    set: { email, name, role, lastLogin: new Date() },
  });
  
  console.log(`  [drizzle]   Upserted user: ${email} (role: ${role})`);
}

async function setFirebaseClaims(
  auth: ReturnType<typeof getAuth>,
  uid: string,
  role: string
) {
  await auth.setCustomUserClaims(uid, { role });
  console.log(`  [firebase] Set custom claims: uid=${uid} role=${role}`);
}

// ─── Cleanup: delete stale auth state so fixtures re-login ───────────────────

function clearAuthStateFiles() {
  const authDir = path.resolve(process.cwd(), "test-results", "auth");
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log(
      "  [seed]     Cleared cached auth state files (test-results/auth/)"
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n[e2e-seed] Seeding E2E test users...\n");

  const auth = initFirebaseAdmin();

  try {
    for (const user of TEST_USERS) {
      console.log(`→ ${user.email} (role: ${user.role})`);
      const uid = await upsertFirebaseUser(
        auth,
        user.email,
        user.password,
        user.name
      );
      await upsertDrizzleUser(db, uid, user.email, user.name, user.role);
      await setFirebaseClaims(auth, uid, user.role);
      console.log();
    }

    // Force global-setup to re-login with fresh credentials
    clearAuthStateFiles();

    console.log("[e2e-seed] Done. All test users are ready.\n");
  } catch (error) {
    console.error("[e2e-seed] Error during seeding:", error);
  }
}

seed().catch((err) => {
  console.error("[e2e-seed] Fatal error:", err);
  process.exit(1);
});
