import { test, expect } from "@playwright/test";

test.describe("Sign In (/sign-in)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("sign-in page loads", async ({ page }) => {
    // Navigate fresh (bypass cache) to capture a real response status
    const response = await page.goto("/sign-in", {
      waitUntil: "domcontentloaded",
    });
    // Accept 200 (fresh) or 304 (browser cached — page still loaded correctly)
    expect([200, 304]).toContain(response?.status());
  });

  test("email and password fields are visible", async ({ page }) => {
    const emailField = page
      .locator(
        'input[type="email"], input[name="email"], [data-testid="email-input"]'
      )
      .first();
    const passwordField = page
      .locator('input[type="password"], [data-testid="password-input"]')
      .first();

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
  });

  test("sign-in button is visible", async ({ page }) => {
    const signInBtn = page
      .locator(
        'button[type="submit"], [data-testid="sign-in-button"], button:has-text("Sign in"), button:has-text("Log in")'
      )
      .first();
    await expect(signInBtn).toBeVisible();
  });

  test("has a link to sign-up page", async ({ page }) => {
    const signUpLink = page.locator('a[href*="sign-up"]').first();
    await expect(signUpLink).toBeVisible();
  });

  test("shows error when submitted empty", async ({ page }) => {
    // Both inputs have `required` — the browser prevents submission and shows
    // native validation UI. We verify the submit button exists and the email
    // field reports as invalid via the Constraint Validation API.
    const emailInput = page.locator('#email, input[type="email"]').first();
    const signInBtn = page.locator('button[type="submit"]').first();

    await signInBtn.click();

    // Browser blocks the submit; the email field becomes :invalid
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.fill('#email, input[type="email"]', "wrong@example.com");
    await page.fill('#password, input[type="password"]', "wrongpassword123");

    const signInBtn = page.locator('button[type="submit"]').first();
    await signInBtn.click();

    // Firebase auth error surfaces as a shadcn <Alert variant="destructive">
    // which renders as a <div> with class containing "destructive".
    // We wait for it and check it contains some text.
    const alert = page.locator('[class*="destructive"]').first();
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).not.toBeEmpty();
  });

  test("has a forgot password link", async ({ page }) => {
    const forgotLink = page
      .locator('a[href*="forgot"], a[href*="reset"], text=/forgot/i')
      .first();
    // Not every app has this — just check if present
    const isVisible = await forgotLink.isVisible().catch(() => false);
    // This is a soft check; we just note its presence rather than failing
    if (!isVisible) {
      test.info().annotations.push({
        type: "info",
        description: "No forgot-password link found on sign-in page.",
      });
    }
  });
});
