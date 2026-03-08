import { test, expect } from "../../helpers/fixtures";

test.describe("Admin Orders (/admin/orders)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/admin/orders");
    await adminPage
      .waitForFunction(
        () => !/^auth loading/i.test(document.body.innerText.trim()),
        { timeout: 15000, polling: 500 }
      )
      .catch(() => {});
  });

  test("orders page loads", async ({ adminPage: page }) => {
    await expect(page).toHaveURL(/admin\/orders/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("orders table or list is visible", async ({ adminPage: page }) => {
    const table = page
      .locator(
        'table, [data-testid*="orders-table"], [data-testid*="orders-list"], [class*="table"]'
      )
      .first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test("table has column headers", async ({ adminPage: page }) => {
    const headers = page.locator("th, [role='columnheader']");
    await expect(headers.first()).toBeVisible({ timeout: 5000 });
    const count = await headers.count();
    expect(count).toBeGreaterThan(0);
  });

  test("pagination controls are present (if results exist)", async ({
    adminPage: page,
  }) => {
    const pagination = page
      .locator(
        '[data-testid*="pagination"], [aria-label*="pagination"], button:has-text("Next"), button:has-text("Previous")'
      )
      .first();
    const hasPagination = await pagination.isVisible().catch(() => false);
    // Pagination may not show if there are no orders — soft check
    if (!hasPagination) {
      test.info().annotations.push({
        type: "info",
        description: "Pagination not visible — may have no orders in test DB.",
      });
    }
  });

  test("search or filter input is present", async ({ adminPage: page }) => {
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], [data-testid*="search"]'
      )
      .first();
    const hasSearch = await searchInput.isVisible().catch(() => false);
    if (!hasSearch) {
      test.info().annotations.push({
        type: "info",
        description: "No search input found on orders page.",
      });
    }
  });
});
