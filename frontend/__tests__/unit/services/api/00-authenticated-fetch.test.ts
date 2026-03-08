/**
 * Authenticated fetch – authenticatedFetch, authenticatedFetchJson.
 * Must run first (00-*) so module loads with mocked auth.
 * Mocks globalThis.fetch directly instead of mock.module on safe-fetch,
 * to avoid leaking module mocks to safe-fetch.test.ts in the same worker.
 */
import { afterEach, beforeEach, describe, it, expect, mock } from "bun:test";

mock.module("@/shared/services/firebase/config", () => ({
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve("mock-id-token"),
    },
  },
}));

const { authenticatedFetch, authenticatedFetchJson } =
  await import("@/shared/services/api/authenticated-fetch");

describe("authenticated-fetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      ) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("authenticatedFetch returns response when user is authenticated", async () => {
    const res = await authenticatedFetch("https://api.example.com/me");
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual({ id: 1 });
  });

  it("authenticatedFetchJson unwraps { data } response", async () => {
    const data = await authenticatedFetchJson<{ id: number }>(
      "https://api.example.com/me"
    );
    expect(data).toEqual({ id: 1 });
  });
});
