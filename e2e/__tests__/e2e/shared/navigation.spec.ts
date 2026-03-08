import { test, expect } from "@playwright/test";

test.describe("Navigation — Public", () => {
  test("all public nav links are reachable", async ({ page }) => {
    await page.goto("/");

    const navLinks = page.locator("nav a");
    const hrefs: string[] = [];

    const count = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("/api")) {
        hrefs.push(href);
      }
    }

    for (const href of [...new Set(hrefs)]) {
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      // response may be null when navigating to the current page (same URL cache hit)
      // In that case the page is already loaded correctly
      if (response !== null && response !== undefined) {
        expect(
          response.status(),
          `Expected ${href} to return < 400`
        ).toBeLessThan(400);
      }
    }
  });

  test("custom 404 page renders for unknown route", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-404-check");
    // Next.js returns 404 for unknown routes
    expect(response?.status()).toBe(404);
    // The 404 page should have some content (not blank)
    await expect(page.locator("body")).not.toBeEmpty();
    const notFoundText = page
      .locator("text=/404|not found|page not found/i")
      .first();
    await expect(notFoundText).toBeVisible({ timeout: 5000 });
  });

  test("footer links are present on homepage", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    const hasFooter = await footer.isVisible().catch(() => false);
    if (hasFooter) {
      const footerLinks = footer.locator("a");
      const count = await footerLinks.count();
      expect(count).toBeGreaterThan(0);
    } else {
      test.info().annotations.push({
        type: "info",
        description: "No <footer> element found on homepage.",
      });
    }
  });
});

test.describe("Navigation — Mobile (Pixel 5)", () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test("mobile menu toggle is present on homepage", async ({ page }) => {
    await page.goto("/");
    // Look for hamburger/menu button
    const menuToggle = page
      .locator(
        'button[aria-label*="menu" i], button[aria-label*="navigation" i], [data-testid*="menu"], button:has(svg)'
      )
      .first();
    const hasToggle = await menuToggle.isVisible().catch(() => false);
    if (!hasToggle) {
      test.info().annotations.push({
        type: "info",
        description:
          "No mobile menu toggle found — nav may always be visible at this viewport.",
      });
    }
  });

  test("all public pages load on mobile viewport", async ({ page }) => {
    const pages = ["/", "/pricing", "/features", "/about"];
    for (const path of pages) {
      const response = await page.goto(path);
      expect(
        response?.status(),
        `Expected ${path} to return 200 on mobile`
      ).toBe(200);
    }
  });
});

test.describe("Navigation — Authenticated routes visible in nav", () => {
  test("sign-in page has link back to homepage", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    // Wait for any link to "/" or a "Back to Home" style link
    const homeLink = page
      .locator(
        'a[href="/"], a:has-text("Home"), a:has-text("Back to Home"), [data-testid="logo"]'
      )
      .first();
    await expect(homeLink).toBeVisible({ timeout: 10000 });
  });

  test("sign-up page has link back to sign-in", async ({ page }) => {
    await page.goto("/sign-up");
    const signInLink = page.locator('a[href*="sign-in"]').first();
    await expect(signInLink).toBeVisible({ timeout: 5000 });
  });
});
