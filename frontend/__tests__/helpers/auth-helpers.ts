import { type Page, type BrowserContext } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * Paths where auth state is saved after a successful login.
 *
 * Firebase stores its auth tokens in IndexedDB (not cookies/localStorage),
 * so Playwright's built-in storageState is always empty for Firebase apps.
 * We save the IndexedDB contents separately in a companion *-idb-state.json
 * file and inject them back in fixtures.ts before each authenticated test.
 */
export const AUTH_STATE_PATHS = {
  user: path.join(
    process.cwd(),
    "test-results",
    "auth",
    "user-storage-state.json"
  ),
  admin: path.join(
    process.cwd(),
    "test-results",
    "auth",
    "admin-storage-state.json"
  ),
} as const;

export const AUTH_IDB_PATHS = {
  user: path.join(process.cwd(), "test-results", "auth", "user-idb-state.json"),
  admin: path.join(
    process.cwd(),
    "test-results",
    "auth",
    "admin-idb-state.json"
  ),
} as const;

export interface TestCredentials {
  email: string;
  password: string;
}

/**
 * Test user credentials. Set via environment variables or fall back to defaults.
 * In CI, provide E2E_USER_EMAIL / E2E_USER_PASSWORD / E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */
export const TEST_USERS = {
  user: {
    email: process.env.E2E_USER_EMAIL ?? "e2e-user@test.example.com",
    password: process.env.E2E_USER_PASSWORD ?? "TestPassword123!",
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@test.example.com",
    password: process.env.E2E_ADMIN_PASSWORD ?? "TestPassword123!",
  },
} satisfies Record<string, TestCredentials>;

/**
 * Sign in via the UI and wait for the redirect.
 */
export async function loginAs(
  page: Page,
  credentials: TestCredentials
): Promise<void> {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  // Wait for the form — fall back to id selectors if data-testid build isn't deployed yet
  await page.waitForSelector(
    '[data-testid="sign-in-form"], #email, [data-testid="email-input"]',
    { timeout: 30000 }
  );

  await page.fill('#email, [data-testid="email-input"]', credentials.email);
  await page.fill(
    '#password, [data-testid="password-input"]',
    credentials.password
  );
  await page.click('button[type="submit"], [data-testid="sign-in-button"]');

  // Wait for redirect away from sign-in page after successful login
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 15000,
  });

  // Give Firebase a moment to finish writing tokens to IndexedDB
  await page.waitForTimeout(1500);
}

/**
 * Extract Firebase auth tokens from IndexedDB and save to disk.
 * Firebase stores tokens in IndexedDB, not cookies/localStorage, so
 * Playwright's storageState() is empty — we handle this ourselves.
 */
export async function saveAuthState(
  context: BrowserContext,
  role: "user" | "admin"
): Promise<void> {
  const dir = path.dirname(AUTH_STATE_PATHS[role]);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save standard storageState (will be empty for Firebase but kept for compatibility)
  await context.storageState({ path: AUTH_STATE_PATHS[role] });

  // Extract Firebase IndexedDB tokens from the page
  const pages = context.pages();
  const page = pages[pages.length - 1];

  const idbData = await page.evaluate(async (): Promise<unknown[]> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("firebaseLocalStorageDb");
      req.onerror = () =>
        reject(new Error("Failed to open firebaseLocalStorageDb"));
      req.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        // The object store may be named differently across Firebase SDK versions
        const storeNames = Array.from(db.objectStoreNames);
        const storeName =
          storeNames.find(
            (n) => n.toLowerCase().includes("firebase") || n === "keyvaluepairs"
          ) ?? storeNames[0];
        if (!storeName) return resolve([]);
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const all = store.getAll();
        all.onsuccess = () => resolve(all.result ?? []);
        all.onerror = () => resolve([]);
      };
    });
  });

  fs.writeFileSync(AUTH_IDB_PATHS[role], JSON.stringify(idbData, null, 2));
}

/**
 * Inject saved Firebase IndexedDB tokens into a new page before navigation.
 * Must be called before page.goto() so the script runs on load.
 */
export async function injectAuthState(
  page: Page,
  role: "user" | "admin"
): Promise<void> {
  const idbPath = AUTH_IDB_PATHS[role];
  if (!fs.existsSync(idbPath)) return;

  const idbData = JSON.parse(fs.readFileSync(idbPath, "utf-8")) as Array<{
    fbase_key: string;
    value: unknown;
  }>;

  if (!idbData.length) return;

  // Inject as an init script so it runs before any page code
  await page.addInitScript(
    ({ entries }: { entries: typeof idbData }) => {
      // Re-populate firebaseLocalStorageDb immediately after it opens
      const originalOpen = indexedDB.open.bind(indexedDB);
      (
        indexedDB as typeof indexedDB & { _e2eInjected?: boolean }
      )._e2eInjected = true;

      function populate(db: IDBDatabase) {
        const storeNames = Array.from(db.objectStoreNames);
        const storeName =
          storeNames.find(
            (n) => n.toLowerCase().includes("firebase") || n === "keyvaluepairs"
          ) ?? storeNames[0];
        if (!storeName) return;
        try {
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          for (const entry of entries) {
            store.put(entry);
          }
        } catch {
          // Ignore — may already be populated
        }
      }

      const req = originalOpen("firebaseLocalStorageDb");
      req.onsuccess = (e) => populate((e.target as IDBOpenDBRequest).result);
      req.onupgradeneeded = (e: any) => {
        const db: IDBDatabase = e.target.result;
        if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
          db.createObjectStore("firebaseLocalStorage", {
            keyPath: "fbase_key",
          });
        }
        populate(db);
      };
    },
    { entries: idbData }
  );
}

/**
 * Check whether saved auth state files exist for the given role.
 */
export function authStateExists(role: "user" | "admin"): boolean {
  return (
    fs.existsSync(AUTH_STATE_PATHS[role]) && fs.existsSync(AUTH_IDB_PATHS[role])
  );
}
