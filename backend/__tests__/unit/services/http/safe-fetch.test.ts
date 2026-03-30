/**
 * Safe fetch – safeFetch, publicFetch, publicFetchJson, externalServiceFetch.
 * Uses global fetch; tests mock fetch to control responses.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  safeFetch,
  publicFetch,
  publicFetchJson,
  externalServiceFetch,
} from "@/services/http/safe-fetch";

describe("safe-fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("safeFetch", () => {
    test("returns response when fetch succeeds", async () => {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ) as any;

      const res = await safeFetch("https://api.example.com/data", {
        timeout: 5000,
        retryAttempts: 0,
        logRequests: false,
      });
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ data: 1 });
    });

    test("retries on retryable error then succeeds", async () => {
      let attempts = 0;
      globalThis.fetch = () => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error("502 Bad Gateway"));
        }
        return Promise.resolve(new Response("ok", { status: 200 })) as any;
      };

      const res = await safeFetch("https://api.example.com/", {
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 10,
        logRequests: false,
        retryOn: () => true,
      });
      expect(res.status).toBe(200);
      expect(attempts).toBe(2);
    });

    test("throws when all retries fail", async () => {
      globalThis.fetch = () => Promise.reject(new Error("Network error"));

      await expect(
        safeFetch("https://api.example.com/", {
          timeout: 500,
          retryAttempts: 1,
          retryDelay: 10,
          logRequests: false,
        }),
      ).rejects.toThrow();
    });

    test("validateResponse can reject response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("bad", { status: 500 })) as any;

      await expect(
        safeFetch("https://api.example.com/", {
          timeout: 5000,
          retryAttempts: 0,
          logRequests: false,
          validateResponse: (r) => r.status < 400,
        }),
      ).rejects.toThrow();
    });
  });

  describe("publicFetch", () => {
    test("returns response with JSON content-type", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("{}", { status: 200 })) as any;

      const res = await publicFetch("https://api.example.com/");
      expect(res.status).toBe(200);
      expect(res.headers).toBeDefined();
    });
  });

  describe("publicFetchJson", () => {
    test("parses JSON and returns data", async () => {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ foo: "bar" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ) as any;

      const data = await publicFetchJson<{ foo: string }>(
        "https://api.example.com/",
      );
      expect(data).toEqual({ foo: "bar" });
    });

    test("throws on non-ok response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
        ) as any;

      await expect(
        publicFetchJson("https://api.example.com/"),
      ).rejects.toThrow();
    });
  });

  describe("externalServiceFetch", () => {
    test("stripe returns response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("{}", { status: 200 })) as any;

      const res = await externalServiceFetch.stripe(
        "https://api.stripe.com/v1/customers",
      );
      expect(res.ok).toBe(true);
    });

    test("zoom returns response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("{}", { status: 200 })) as any;

      const res = await externalServiceFetch.zoom(
        "https://api.zoom.us/v2/users/me",
      );
      expect(res.ok).toBe(true);
    });

    test("firebase returns response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("{}", { status: 200 })) as any;

      const res = await externalServiceFetch.firebase(
        "https://identitytoolkit.googleapis.com/v1/accounts",
      );
      expect(res.ok).toBe(true);
    });

    test("general returns response", async () => {
      globalThis.fetch = () =>
        Promise.resolve(new Response("{}", { status: 200 })) as any;

      const res = await externalServiceFetch.general(
        "https://api.example.com/",
      );
      expect(res.ok).toBe(true);
    });
  });

  describe("safeFetch retry conditions and signal", () => {
    test("does not retry when retryOn returns false", async () => {
      let attempts = 0;
      globalThis.fetch = () => {
        attempts++;
        return Promise.reject(new Error("502 Bad Gateway"));
      };

      await expect(
        safeFetch("https://api.example.com/", {
          timeout: 500,
          retryAttempts: 2,
          retryDelay: 10,
          logRequests: false,
          retryOn: () => false,
        }),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    test("retries on timeout (AbortError)", async () => {
      let attempts = 0;
      globalThis.fetch = () => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(
            Object.assign(new Error("timeout"), { name: "AbortError" }),
          );
        }
        return Promise.resolve(new Response("ok", { status: 200 })) as any;
      };

      const res = await safeFetch("https://api.example.com/", {
        timeout: 500,
        retryAttempts: 2,
        retryDelay: 10,
        logRequests: false,
        retryOn: (e) =>
          e.name === "AbortError" || e.message.includes("timeout"),
      });
      expect(res.status).toBe(200);
      expect(attempts).toBe(2);
    });
  });
});
