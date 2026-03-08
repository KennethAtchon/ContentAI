/**
 * Test helper: creates a configured Hono app for integration testing.
 * All external dependencies (firebase, prisma, redis) are mocked via preload.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";

export function createTestApp() {
  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: "http://localhost:3000",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Requested-With",
      ],
      credentials: true,
    }),
  );

  return app;
}

/**
 * Standard mock auth result for protected route tests.
 */
export const mockAuthResult = {
  user: {
    id: "test-user-id",
    firebaseUid: "test-user-uid",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    isActive: true,
    isDeleted: false,
    timezone: "UTC",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  userId: "test-user-uid",
  firebaseUser: {
    uid: "test-user-uid",
    email: "test@example.com",
    stripeRole: "basic",
  },
};

/**
 * Make a request to the given Hono app and return parsed response.
 */
export async function req(
  app: Hono,
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; data: any; headers: Headers }> {
  const res = await app.request(path, options);
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}
