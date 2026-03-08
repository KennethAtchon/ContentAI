import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Starting E2E global teardown...");
  
  // Optional: Clean up any global test data or services here
  // For now, we'll just log that teardown completed
  
  console.log("✅ E2E global teardown completed");
}

export default globalTeardown;
