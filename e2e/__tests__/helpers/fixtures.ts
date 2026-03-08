import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const USER_STORAGE_STATE = path.join(
  process.cwd(),
  "test-results/auth/user-storage-state.json"
);

const ADMIN_STORAGE_STATE = path.join(
  process.cwd(),
  "test-results/auth/admin-storage-state.json"
);

type Fixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const storageState = fs.existsSync(USER_STORAGE_STATE)
      ? USER_STORAGE_STATE
      : undefined;
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const storageState = fs.existsSync(ADMIN_STORAGE_STATE)
      ? ADMIN_STORAGE_STATE
      : undefined;
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
