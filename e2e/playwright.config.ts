import { defineConfig, devices } from "@playwright/test";

// Read directly from process.env to avoid loading envUtil (which requires all
// Firebase/DB env vars to be set even when just listing/running E2E tests).
const IS_CI = process.env.CI === "true" || process.env.CI === "1";
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "__tests__/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: IS_CI,
  /* Retry on CI only */
  retries: IS_CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: IS_CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["line"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot only on failure */
    screenshot: "only-on-failure",

    /* Record video only on failure */
    video: "retain-on-failure",

    /* Global timeout for each action */
    actionTimeout: 10000,

    /* Global timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    // webkit (Safari) — requires Debian/Ubuntu system libs; runs in CI (ubuntu-latest) only
    ...(IS_CI
      ? [
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },

    // Mobile Safari — webkit engine, CI only (Debian/Ubuntu system libs required)
    ...(IS_CI
      ? [
          {
            name: "Mobile Safari",
            use: { ...devices["iPhone 12"] },
          },
        ]
      : []),

    /* Microsoft Edge — CI only (requires Edge browser installed) */
    ...(IS_CI
      ? [
          {
            name: "Microsoft Edge",
            use: { ...devices["Desktop Edge"], channel: "msedge" },
          },
        ]
      : []),
  ],


  /* Global setup and teardown */
  globalSetup: "./__tests__/helpers/global-setup.ts",
  globalTeardown: "./__tests__/helpers/global-teardown.ts",
});
