import { test, expect } from "@playwright/test";

/**
 * Smoke tests for all public marketing pages.
 * Verifies each page loads (200), has a visible heading, and sets a title.
 */

const PUBLIC_PAGES = [
  { path: "/about", label: "About" },
  { path: "/features", label: "Features" },
  { path: "/pricing", label: "Pricing" },
  { path: "/faq", label: "FAQ" },
  { path: "/privacy", label: "Privacy" },
  { path: "/terms", label: "Terms" },
  { path: "/support", label: "Support" },
  { path: "/api-documentation", label: "API Documentation" },
] as const;

for (const { path, label } of PUBLIC_PAGES) {
  test.describe(`${label} page (${path})`, () => {
    test("loads with 200 status", async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      // Accept 200 (fresh) or 304 (browser cached — page loaded correctly)
      expect([200, 304]).toContain(response?.status());
    });

    test("has a visible heading", async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    test("page title is set", async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveTitle(/.+/);
    });
  });
}

test.describe("Pricing page specifics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  });

  test("shows pricing plans", async ({ page }) => {
    // At least one pricing card or plan section should be visible
    const planElements = page.locator(
      '[data-testid*="plan"], [data-testid*="pricing"], .pricing-card, [class*="pricing"]'
    );
    // Fall back: look for any section containing a price indicator
    const priceText = page.locator("text=/\\$|free|month/i").first();
    const hasPlans =
      (await planElements.count()) > 0 ||
      (await priceText.isVisible().catch(() => false));
    expect(hasPlans).toBe(true);
  });

  test("has a sign-up or get-started CTA", async ({ page }) => {
    // Pricing cards use "Get Started" buttons; the bottom CTA links to checkout.
    // Avoid a[href*="sign-up"] which also matches the hidden mobile nav Sign Up button.
    const cta = page
      .locator(
        'main button:has-text("Get started"), main button:has-text("Sign up"), main button:has-text("Start"), main a[href*="checkout"]'
      )
      .first();
    await expect(cta).toBeVisible({ timeout: 10000 });
  });
});

test.describe("FAQ page specifics", () => {
  test("FAQ items are present", async ({ page }) => {
    // Use domcontentloaded to avoid long waits on heavy pages
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    // Accordion items or question elements
    const faqItems = page.locator(
      '[data-testid*="faq"], details, [class*="accordion"], [class*="faq"]'
    );
    const questionText = page.locator("text=/\\?/").first();
    const hasItems =
      (await faqItems.count()) > 0 ||
      (await questionText.isVisible().catch(() => false));
    expect(hasItems).toBe(true);
  });
});
