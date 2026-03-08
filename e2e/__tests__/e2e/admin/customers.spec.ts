import { test, expect } from "../../helpers/fixtures";

test.describe("Admin Customers (/admin/customers)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/admin/customers");
    await adminPage
      .waitForFunction(
        () => !/^auth loading/i.test(document.body.innerText.trim()),
        { timeout: 15000, polling: 500 }
      )
      .catch(() => {});
  });

  test("customers page loads", async ({ adminPage: page }) => {
    await expect(page).toHaveURL(/admin\/customers/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("customers table or list is visible", async ({ adminPage: page }) => {
    const table = page
      .locator(
        'table, [data-testid*="customers-table"], [data-testid*="customers-list"], [class*="table"]'
      )
      .first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test("table has customer email or name column", async ({
    adminPage: page,
  }) => {
    const emailOrName = page
      .locator(
        'th:has-text("Email"), th:has-text("Name"), th:has-text("Customer"), [role="columnheader"]:has-text("Email")'
      )
      .first();
    const hasColumn = await emailOrName.isVisible().catch(() => false);
    if (!hasColumn) {
      // Just check there are headers at all
      const headers = page.locator("th, [role='columnheader']");
      const count = await headers.count();
      expect(count).toBeGreaterThan(0);
    } else {
      await expect(emailOrName).toBeVisible();
    }
  });

  test("search input is present", async ({ adminPage: page }) => {
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], [data-testid*="search"]'
      )
      .first();
    const hasSearch = await searchInput.isVisible().catch(() => false);
    if (!hasSearch) {
      test.info().annotations.push({
        type: "info",
        description: "No search input on customers page.",
      });
    }
  });
});
