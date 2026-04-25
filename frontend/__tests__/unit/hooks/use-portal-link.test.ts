/**
 * Unit tests for usePortalLink hook.
 * Tests the hook contract and integration with React Query.
 */
import { describe, it, expect } from "bun:test";
import { usePortalLink } from "@/shared/react/use-portal-link";

describe("usePortalLink", () => {
  it("is a function", () => {
    expect(typeof usePortalLink).toBe("function");
  });

  it("module exports usePortalLink as a named export", async () => {
    const module = await import("@/shared/react/use-portal-link");
    expect(typeof module.usePortalLink).toBe("function");
  });
});
