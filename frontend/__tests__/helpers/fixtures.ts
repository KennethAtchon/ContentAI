import { test as base, type Browser, type Page } from "@playwright/test";
import {
  AUTH_STATE_PATHS,
  authStateExists,
  injectAuthState,
} from "./auth-helpers";

/**
 * Extended Playwright fixtures that provide pre-authenticated pages.
 *
 * Firebase stores auth tokens in IndexedDB (not cookies/localStorage), so
 * Playwright's built-in storageState is always empty for this app.
 * We inject the saved IndexedDB entries via addInitScript before any
 * navigation so the app sees a logged-in user on the very first page load.
 *
 * Usage:
 *   import { test } from "../helpers/fixtures";
 *   test("my test", async ({ authenticatedPage }) => { ... });
 */

type Fixtures = {
  /** A page already logged in as a regular user. */
  authenticatedPage: Page;
  /** A page already logged in as an admin user. */
  adminPage: Page;
};

/**
 * Wait for Firebase auth to finish rehydrating after an IDB injection.
 * Polls until the "Loading..." / "Auth Loading" spinners disappear.
 */
async function waitForAuthReady(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        // Auth is still loading if we see a full-screen spinner with auth-related text
        const allText = document.body?.innerText ?? "";
        const isAuthLoading =
          /^auth loading/i.test(allText.trim()) ||
          // Single loading spinner with nothing else rendered yet
          (allText.trim().toLowerCase() === "loading..." &&
            document.querySelectorAll("nav, h1, h2, form, table").length === 0);
        return !isAuthLoading;
      },
      { timeout: 15000, polling: 300 }
    )
    .catch(() => {
      // Timed out — proceed anyway, individual test assertions will catch real failures
    });
}

async function makeAuthPage(
  browser: Browser,
  role: "user" | "admin"
): Promise<{ page: Page; close: () => Promise<void> }> {
  if (!authStateExists(role)) {
    throw new Error(
      `Auth state not found for role "${role}".\n` +
        `Run: bun test:e2e:seed  (then re-run tests so global-setup can log in)`
    );
  }

  const context = await browser.newContext({
    // storageState is empty for Firebase apps but kept for any future cookies
    storageState: AUTH_STATE_PATHS[role],
  });
  const page = await context.newPage();

  // Inject Firebase IndexedDB tokens as an init script — runs before any page code
  await injectAuthState(page, role);

  // Wrap goto to automatically wait for Firebase auth to settle after each navigation
  const originalGoto = page.goto.bind(page);
  (page as Page & { goto: typeof page.goto }).goto = async (url, options) => {
    const response = await originalGoto(url, options);
    await waitForAuthReady(page);
    return response;
  };

  return { page, close: () => context.close() };
}

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const { page, close } = await makeAuthPage(browser, "user");
    await use(page);
    await close();
  },

  adminPage: async ({ browser }, use) => {
    const { page, close } = await makeAuthPage(browser, "admin");
    await use(page);
    await close();
  },
});

export { expect } from "@playwright/test";
