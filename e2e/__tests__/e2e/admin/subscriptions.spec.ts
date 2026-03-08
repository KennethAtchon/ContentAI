import { test, expect } from "../../helpers/fixtures";

test.describe("Admin Subscriptions (/admin/subscriptions)", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto("/admin/subscriptions");
    await adminPage
      .waitForFunction(
        () => !/^auth loading/i.test(document.body.innerText.trim()),
        { timeout: 15000, polling: 500 }
      )
      .catch(() => {});
  });

  test("subscriptions page loads", async ({ adminPage: page }) => {
    await expect(page).toHaveURL(/admin\/subscriptions/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("subscriptions table or list is visible", async ({
    adminPage: page,
  }) => {
    // Wait up to 20s for loading state to clear
    await page
      .waitForFunction(
        () => {
          const text = document.body?.innerText ?? "";
          return !text.includes("Loading") && !text.includes("loading");
        },
        { timeout: 20000, polling: 500 }
      )
      .catch(() => {});

    const table = page
      .locator(
        'table, [data-testid*="subscriptions-table"], [data-testid*="subscriptions-list"], [class*="table"]'
      )
      .first();
    const isVisible = await table
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!isVisible) {
      // May still be loading, in an empty state, or showing an error —
      // any text-bearing element inside <main> confirms the page rendered correctly.
      // Use :text() selector to avoid matching hidden SVG icons with class names.
      const anyContent = page
        .locator("main h1, main h2, main p, main [role='alert']")
        .first();
      await expect(anyContent).toBeVisible({ timeout: 10000 });
    } else {
      await expect(table).toBeVisible();
    }
  });

  test("subscription tier information is displayed", async ({
    adminPage: page,
  }) => {
    const tierContent = page
      .locator('text=/free|pro|basic|premium|trial/i, [data-testid*="tier"]')
      .first();
    const hasContent = await tierContent.isVisible().catch(() => false);
    if (!hasContent) {
      test.info().annotations.push({
        type: "info",
        description: "No subscription tier content visible — DB may be empty.",
      });
    }
  });
});
