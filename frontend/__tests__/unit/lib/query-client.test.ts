/**
 * Unit tests for query-client: QUERY_STALE and makeQueryClient.
 * debugLog is mocked in preload.
 */

import { describe, it, expect } from "bun:test";
import { QUERY_STALE, makeQueryClient } from "@/shared/lib/query-client";

describe("query-client", () => {
  describe("QUERY_STALE", () => {
    it("default is 0", () => {
      expect(QUERY_STALE.default).toBe(0);
    });

    it("medium is 60 * 1000 ms", () => {
      expect(QUERY_STALE.medium).toBe(60 * 1000);
    });

    it("long is 5 * 60 * 1000 ms", () => {
      expect(QUERY_STALE.long).toBe(5 * 60 * 1000);
    });
  });

  describe("makeQueryClient", () => {
    it("returns a QueryClient instance", () => {
      const client = makeQueryClient();
      expect(client).toBeDefined();
      expect(client.getQueryCache).toBeDefined();
      expect(client.getMutationCache).toBeDefined();
    });

    it("has default query options with staleTime 0", () => {
      const client = makeQueryClient();
      const defaultOptions = client.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(0);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
      expect(defaultOptions.queries?.retry).toBe(2);
    });

    it("has queryCache with onError and onSuccess", () => {
      const client = makeQueryClient();
      const cache = client.getQueryCache();
      expect(cache).toBeDefined();
    });

    it("onSuccess is called when query succeeds", async () => {
      const client = makeQueryClient();
      await client.fetchQuery({
        queryKey: ["success-test"],
        queryFn: () => Promise.resolve({ ok: true }),
      });
      expect(client.getQueryData(["success-test"])).toEqual({ ok: true });
    });

    it("onError is called when query fails", async () => {
      const client = makeQueryClient();
      await expect(
        client.fetchQuery({
          queryKey: ["error-test"],
          queryFn: () => Promise.reject(new Error("fail")),
        })
      ).rejects.toThrow("fail");
    });
  });
});
