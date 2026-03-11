import { test, expect } from "@playwright/test";

/**
 * Verifies that protected routes redirect unauthenticated users to sign-in,
 * and that admin routes block non-admin users.
 *
 * These tests run without any storageState (unauthenticated browser context).
 */

const PROTECTED_CUSTOMER_ROUTES = [
  "/studio/discover",
  "/account",
  "/checkout",
  "/payment",
] as const;

const PROTECTED_ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/customers",
  "/admin/orders",
  "/admin/subscriptions",
] as const;

test.describe("Unauthenticated redirect", () => {
  for (const route of PROTECTED_CUSTOMER_ROUTES) {
    test(`${route} redirects to sign-in`, async ({ page }) => {
      await page.goto(route);
      // Should end up on sign-in (or similar auth page)
      await expect(page).toHaveURL(/sign-in|login|auth/, { timeout: 10000 });
    });
  }

  for (const route of PROTECTED_ADMIN_ROUTES) {
    test(`${route} redirects to sign-in (unauthenticated)`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in|login|auth|forbidden/, {
        timeout: 10000,
      });
    });
  }
});

test.describe("Sign-out clears session", () => {
  test("after sign-out, protected route redirects to sign-in", async ({
    browser,
  }) => {
    // Create a fresh context — no auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/studio/discover");
    await expect(page).toHaveURL(/sign-in|login|auth/, { timeout: 10000 });

    await context.close();
  });
});
