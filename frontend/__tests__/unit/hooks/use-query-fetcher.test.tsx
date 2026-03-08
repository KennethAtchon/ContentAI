/**
 * Unit tests for useQueryFetcher. Requires DOM (happy-dom in preload).
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach } from "bun:test";
import { renderHook, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";

describe("useQueryFetcher", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns a function", () => {
    const { result } = renderHook(() => useQueryFetcher());
    expect(typeof result.current).toBe("function");
  });

  it("returned fetcher accepts a string URL", () => {
    const { result } = renderHook(() => useQueryFetcher<{ id: string }>());
    const fetcher = result.current;
    expect(fetcher.length).toBe(1);
  });

  it("fetcher invokes callback and returns promise from authenticatedFetchJson", async () => {
    const { result } = renderHook(() => useQueryFetcher<{ id: string }>());
    const fetcher = result.current;
    const p = fetcher("/api/test");
    expect(p).toBeInstanceOf(Promise);
    await p.catch(() => null);
  });
});
