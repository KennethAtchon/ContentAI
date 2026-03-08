/**
 * Unit tests for addTimezoneHeader utility
 */
import { describe, expect, test } from "bun:test";
import { addTimezoneHeader } from "@/utils/api/add-timezone-header";

describe("addTimezoneHeader", () => {
  test("should add x-timezone header to empty options", () => {
    const result = addTimezoneHeader({});
    expect(result.headers).toBeDefined();
    expect(result.headers).toHaveProperty("x-timezone");
    expect(
      typeof (result.headers as Record<string, string>)["x-timezone"],
    ).toBe("string");
  });

  test("should merge with existing headers", () => {
    const result = addTimezoneHeader({
      headers: { "Content-Type": "application/json" },
    });
    expect(result.headers).toHaveProperty("x-timezone");
    expect((result.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  test("should preserve other options", () => {
    const result = addTimezoneHeader({ method: "POST", body: "{}" });
    expect(result.method).toBe("POST");
    expect(result.body).toBe("{}");
    expect(result.headers).toHaveProperty("x-timezone");
  });
});
