import { test, expect } from "@playwright/test";

test.describe("Sign Up (/sign-up)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
  });

  test("sign-up page loads", async ({ page }) => {
    // Navigate fresh (bypass cache) to capture a real response status
    const response = await page.goto("/sign-up", {
      waitUntil: "domcontentloaded",
    });
    // Accept 200 (fresh) or 304 (browser cached — page still loaded correctly)
    expect([200, 304]).toContain(response?.status());
  });

  test("required form fields are visible", async ({ page }) => {
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

  test("sign-up submit button is visible", async ({ page }) => {
    const submitBtn = page
      .locator(
        'button[type="submit"], [data-testid="sign-up-button"], button:has-text("Sign up"), button:has-text("Create account"), button:has-text("Register")'
      )
      .first();
    await expect(submitBtn).toBeVisible();
  });

  test("has a link back to sign-in", async ({ page }) => {
    const signInLink = page.locator('a[href*="sign-in"]').first();
    await expect(signInLink).toBeVisible();
  });

  test("shows validation error when submitted empty", async ({ page }) => {
    // All inputs have `required` — browser validation fires before React.
    // Verify that the name field (first required input) becomes invalid.
    const nameInput = page.locator('#name, input[type="text"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await submitBtn.click();

    const isInvalid = await nameInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    );
    expect(isInvalid).toBe(true);
  });

  test("shows error for mismatched passwords", async ({ page }) => {
    // Fill all required fields with valid values but mismatched passwords.
    // The password field has minLength=6 so use a long-enough value.
    await page.fill('#name, input[type="text"]', "Test User");
    await page.fill('#email, input[type="email"]', "test@example.com");
    await page.fill("#password", "password123");
    await page.fill("#confirmPassword", "differentpass");

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // validatePassword() fires and sets error state → renders destructive Alert
    const alert = page.locator('[class*="destructive"]').first();
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).not.toBeEmpty();
  });

  test("has a confirm password field", async ({ page }) => {
    // The sign-up form has both password and confirmPassword fields.
    // Wait for fields to mount (form has a hydration skeleton).
    await page.waitForSelector("#password", {
      state: "visible",
      timeout: 10000,
    });
    const passwordFields = page.locator('input[type="password"]');
    const count = await passwordFields.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
