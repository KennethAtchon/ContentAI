import { describe, expect, test } from "bun:test";
import { evaluate, springValue } from "@/features/editor/caption/easing";

describe("easing", () => {
  test("evaluates linear and ease-out curves", () => {
    expect(evaluate({ type: "linear" }, 0.5)).toBe(0.5);
    expect(evaluate({ type: "ease-out", power: 2 }, 0.5)).toBe(0.75);
  });

  test("evaluates ease-in-out curves", () => {
    expect(evaluate({ type: "ease-in-out", power: 2 }, 0.25)).toBe(0.125);
    expect(evaluate({ type: "ease-in-out", power: 2 }, 0.75)).toBe(0.875);
  });

  test("springValue approaches 1 over time", () => {
    expect(springValue(0, 400, 0.7, 0.8)).toBeCloseTo(0, 5);
    expect(springValue(1, 400, 0.7, 0.8)).toBeGreaterThan(0.8);
  });
});
