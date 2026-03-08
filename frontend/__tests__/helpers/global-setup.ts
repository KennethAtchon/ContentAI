import { chromium, type FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import http from "http";
import {
  TEST_USERS,
  loginAs,
  saveAuthState,
  authStateExists,
} from "./auth-helpers";

/**
 * Global setup runs once before all E2E tests.
 * The dev server is started automatically by playwright.config.ts (webServer).
 *
 * Workflow:
 *   1. If auth state files are missing, run e2e-seed.ts to create/update
 *      the Firebase + Postgres test accounts automatically.
 *   2. Log in as both the regular user and admin user via the UI.
 *   3. Save storageState (cookies + localStorage) to disk so fixtures.ts
 *      can load them without re-authenticating in every test.
 *
 * On subsequent runs the cached state files are reused (fast path).
 * Delete test-results/auth/ to force a re-login, or run `bun test:e2e:seed`
 * to recreate the accounts and clear the cache.
 */
/** Poll until the dev server responds, so login doesn't race against startup. */
async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const req = http.get(url, () => resolve(true));
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `[global-setup] Server at ${url} did not become ready within ${timeoutMs}ms`
  );
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const needsUser = !authStateExists("user");
  const needsAdmin = !authStateExists("admin");

  if (!needsUser && !needsAdmin) {
    console.log(
      "[global-setup] Auth state files already exist — skipping seed & login."
    );
    console.log("[global-setup] E2E environment ready.");
    return;
  }

  // Seed test users into Firebase + Postgres before attempting to log in.
  console.log("[global-setup] Auth state missing — running e2e-seed...");
  try {
    execSync("bun __tests__/helpers/e2e-seed.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch (err) {
    console.error(
      "[global-setup] e2e-seed failed. Tests requiring authentication will fail.\n" +
        "Check your .env.local for FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, " +
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID and DATABASE_URL.",
      err
    );
    // Don't abort the whole run — public tests should still pass.
    return;
  }

  // Ensure the dev server is accepting connections before we try to log in.
  console.log(`[global-setup] Waiting for server at ${baseURL}...`);
  await waitForServer(baseURL);
  console.log("[global-setup] Server is ready.");

  const browser = await chromium.launch();

  try {
    if (needsUser) {
      console.log(
        `[global-setup] Logging in as user: ${TEST_USERS.user.email}`
      );
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await loginAs(page, TEST_USERS.user);
        await saveAuthState(context, "user");
        console.log("[global-setup] User auth state saved.");
      } finally {
        await context.close();
      }
    }

    if (needsAdmin) {
      console.log(
        `[global-setup] Logging in as admin: ${TEST_USERS.admin.email}`
      );
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await loginAs(page, TEST_USERS.admin);
        await saveAuthState(context, "admin");
        console.log("[global-setup] Admin auth state saved.");
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log("[global-setup] E2E environment ready.");
}

export default globalSetup;
