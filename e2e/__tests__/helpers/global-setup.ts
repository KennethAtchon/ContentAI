import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting E2E global setup...");
  
  // Optional: Set up any global test data or services here
  // For now, we'll just verify that the required services are accessible
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const frontendUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
  const backendUrl = process.env.VITE_API_URL || "http://localhost:3001";

  try {
    // Verify frontend is accessible
    await page.goto(frontendUrl);
    console.log("✅ Frontend is accessible");

    // Verify backend is accessible
    const backendResponse = await page.request.get(`${backendUrl}/api/live`);
    if (backendResponse.ok()) {
      console.log("✅ Backend is accessible");
    } else {
      throw new Error(`Backend health check failed: ${backendResponse.status()}`);
    }
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log("✅ E2E global setup completed");
}

export default globalSetup;
