import type { FullConfig } from "@playwright/test";

/**
 * Global teardown runs once after all E2E tests complete.
 * Clean up any seeded data or shared state here.
 */
async function globalTeardown(_config: FullConfig) {
  console.log("[global-teardown] E2E cleanup complete.");
}

export default globalTeardown;
