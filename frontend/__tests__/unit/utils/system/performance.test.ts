import { afterEach, describe, expect, test } from "bun:test";
import { systemPerformance } from "@/shared/utils/system/performance";

describe("systemPerformance", () => {
  afterEach(() => {
    systemPerformance.clear();
  });

  test("records marks, measures, timers, and debug snapshot providers", () => {
    const unregister = systemPerformance.registerSnapshotProvider(
      "unit",
      () => ({
        ok: true,
      })
    );

    try {
      systemPerformance.mark("unit.start");
      const timerId = systemPerformance.start("unit.timer", { phase: "test" });
      expect(timerId).toBeTruthy();

      const timerRecord = systemPerformance.stop(timerId ?? undefined, {
        complete: true,
      });
      systemPerformance.mark("unit.end");
      const measureRecord = systemPerformance.measure(
        "unit.measure",
        "unit.start",
        "unit.end"
      );

      const snapshot = window.__REEL_EDITOR_DEBUG__?.snapshot();

      expect(timerRecord).toEqual(
        expect.objectContaining({
          name: "unit.timer",
          detail: expect.objectContaining({
            phase: "test",
            complete: true,
          }),
        })
      );
      expect(measureRecord?.name).toBe("unit.measure");
      expect(snapshot?.debug.unit).toEqual({ ok: true });
      expect(snapshot?.measures.map((record) => record.name)).toContain(
        "unit.timer"
      );
    } finally {
      unregister();
    }
  });

  test("keeps the legacy start then stop(label) flow working", () => {
    systemPerformance.start();
    const record = systemPerformance.stop("legacy.operation");

    expect(record).toEqual(
      expect.objectContaining({
        name: "legacy.operation",
      })
    );
  });
});
