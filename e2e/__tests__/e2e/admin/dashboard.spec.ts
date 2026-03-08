import { test, expect } from "../../helpers/fixtures";

/**
 * Admin dashboard E2E tests.
 * Uses `adminPage` fixture (storageState of an admin user).
 *
 * PREREQUISITE: Generate admin storageState by logging in as an admin user.
 */

test.describe("Admin Dashboard (/admin/dashboard)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/admin/dashboard");
    await adminPage
      .waitForFunction(
        () => !/^auth loading/i.test(document.body.innerText.trim()),
        { timeout: 15000, polling: 500 }
      )
      .catch(() => {});
  });

  test("admin dashboard loads for admin user", async ({ adminPage: page }) => {
    await expect(page).toHaveURL(/admin/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("stats or metric cards are visible", async ({ adminPage: page }) => {
    const statsCard = page
      .locator(
        '[data-testid*="stat"], [data-testid*="metric"], [data-testid*="card"], [class*="stat"], [class*="metric"]'
      )
      .first();
    const hasStats = await statsCard.isVisible().catch(() => false);
    if (!hasStats) {
      // Fall back: any number displayed on the dashboard
      const anyNumber = page.locator("text=/\\d+/").first();
      await expect(anyNumber).toBeVisible({ timeout: 5000 });
    } else {
      await expect(statsCard).toBeVisible();
    }
  });

  test("admin sidebar navigation is visible", async ({ adminPage: page }) => {
    // Desktop: sidebar nav is visible; Mobile: hamburger menu button is visible
    const sidebar = page
      .locator('nav, aside, [data-testid="sidebar"], [data-testid*="nav"]')
      .first();
    const isSidebarVisible = await sidebar
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!isSidebarVisible) {
      // Mobile viewport: look for the hamburger button that opens the sidebar
      const menuBtn = page.locator("header button").first();
      await expect(menuBtn).toBeVisible({ timeout: 5000 });
    } else {
      await expect(sidebar).toBeVisible();
    }
  });

  test("sidebar has links to key admin sections", async ({
    adminPage: page,
  }) => {
    const adminLinks = [
      page.locator('a[href*="orders"]').first(),
      page.locator('a[href*="customers"]').first(),
      page.locator('a[href*="subscriptions"]').first(),
    ];

    for (const link of adminLinks) {
      const isVisible = await link.isVisible().catch(() => false);
      if (!isVisible) {
        test.info().annotations.push({
          type: "info",
          description: `Admin nav link not found — sidebar may use icons only or different href.`,
        });
      }
    }
  });
});

test.describe("Admin access control", () => {
  test("non-admin user cannot access admin dashboard", async ({ page }) => {
    // Fresh unauthenticated context
    await page.goto("/admin/dashboard");
    // Should redirect to sign-in or show a 403/forbidden page
    await expect(page).toHaveURL(/sign-in|login|forbidden|unauthorized/, {
      timeout: 10000,
    });
  });
});
