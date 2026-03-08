/**
 * Unit test for cn utility function
 * Tests the className merging utility
 */
import { describe, expect, test } from "bun:test";
import { cn } from "@/shared/utils/helpers/utils";

describe("cn utility function", () => {
  test("should merge class names correctly", () => {
    const result = cn("foo", "bar");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  test("should handle conditional classes", () => {
    const result = cn("foo", false && "bar", "baz");
    expect(result).toContain("foo");
    expect(result).toContain("baz");
    expect(result).not.toContain("bar");
  });

  test("should merge Tailwind classes and resolve conflicts", () => {
    const result = cn("px-2 py-1", "px-4");
    // The later class should override the earlier one
    expect(result).toContain("py-1");
    // px-4 should override px-2
    expect(result).not.toContain("px-2");
    expect(result).toContain("px-4");
  });

  test("should handle empty inputs", () => {
    const result = cn();
    expect(result).toBe("");
  });

  test("should handle undefined and null values", () => {
    const result = cn("foo", undefined, null, "bar");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });
});
