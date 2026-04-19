import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";

const MAX_RECORDS = 160;

export type PerformanceDetail = Record<string, unknown>;

export interface SystemPerformanceRecord {
  name: string;
  durationMs: number;
  startedAtMs: number;
  endedAtMs: number;
  detail?: PerformanceDetail;
  startMark?: string;
  endMark?: string;
}

export interface SystemPerformanceSnapshot {
  enabled: boolean;
  capturedAt: string;
  marks: Record<string, number>;
  measures: SystemPerformanceRecord[];
  debug: Record<string, unknown>;
}

export interface ReelEditorDebugRuntime {
  snapshot(): SystemPerformanceSnapshot;
  clear(): void;
  mark(name: string, detail?: PerformanceDetail): void;
  measure(
    name: string,
    startMark: string,
    endMark?: string,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null;
  start(name: string, detail?: PerformanceDetail): string | null;
  stop(
    timerIdOrLabel?: string,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null;
  getMeasures(name?: string): SystemPerformanceRecord[];
  setDebugValue(key: string, value: unknown): void;
  registerSnapshotProvider(key: string, provider: () => unknown): () => void;
}

type ActiveTimer = {
  name: string;
  startedAtMs: number;
  detail?: PerformanceDetail;
};

class PerformanceSingleton {
  private static instance: PerformanceSingleton;
  private readonly enabled = IS_DEVELOPMENT;
  private readonly activeTimers = new Map<string, ActiveTimer>();
  private readonly debugValues = new Map<string, unknown>();
  private readonly marks = new Map<string, number>();
  private readonly records: SystemPerformanceRecord[] = [];
  private readonly snapshotProviders = new Map<string, () => unknown>();
  private lastTimerId: string | null = null;
  private timerSequence = 0;

  private constructor() {
    this.installEditorDebugRuntime();
  }

  public static getInstance(): PerformanceSingleton {
    if (!PerformanceSingleton.instance) {
      PerformanceSingleton.instance = new PerformanceSingleton();
    }
    return PerformanceSingleton.instance;
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  // Mark means record the current timestamp, accessible by this name.
  // If we need to know elapsed time later, measure() compares two mark names.
  public mark(name: string, _detail?: PerformanceDetail): void {
    if (!this.enabled) return;

    const timestamp = this.now();
    this.marks.set(name, timestamp);
  }

  // Measure the effective duration between two marks.
  public measure(
    name: string,
    startMark: string,
    endMark?: string,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null {
    if (!this.enabled) return null;

    const startTime = this.marks.get(startMark);
    const endTime = endMark ? this.marks.get(endMark) : this.now();
    if (typeof startTime !== "number" || typeof endTime !== "number") {
      return null;
    }

    return this.record(name, Math.max(0, endTime - startTime), {
      ...detail,
      startMark,
      endMark,
    });
  }

  // Measure the complete duration of a mark, until now.
  public measureSince(
    name: string,
    startMark: string,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null {
    return this.measure(name, startMark, undefined, detail);
  }

  // Start a timer
  public start(name = "operation", detail?: PerformanceDetail): string | null {
    if (!this.enabled) return null;

    const timerId = `${name}:${this.timerSequence + 1}`;
    this.timerSequence += 1;
    this.lastTimerId = timerId;
    this.activeTimers.set(timerId, {
      name,
      startedAtMs: this.now(),
      detail,
    });
    return timerId;
  }

  // Either use the last start or use a timer id, calculate the duration. Entry gets removed immediately on stop.
  public stop(
    timerIdOrLabel?: string,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null {
    if (!this.enabled) return null;

    const usedExplicitTimerId =
      !!timerIdOrLabel && this.activeTimers.has(timerIdOrLabel);
    const timerId = usedExplicitTimerId ? timerIdOrLabel : this.lastTimerId;
    if (!timerId) return null;

    const timer = this.activeTimers.get(timerId);
    if (!timer) return null;

    this.activeTimers.delete(timerId);
    if (this.lastTimerId === timerId) {
      this.lastTimerId = null;
    }

    const endedAtMs = this.now();
    const name = usedExplicitTimerId
      ? timer.name
      : (timerIdOrLabel ?? timer.name);

    return this.record(name, Math.max(0, endedAtMs - timer.startedAtMs), {
      ...timer.detail,
      ...detail,
    });
  }

  // Adds the name and duration to an in-memory record for bookkeeping.
  public record(
    name: string,
    durationMs: number,
    detail?: PerformanceDetail
  ): SystemPerformanceRecord | null {
    if (!this.enabled) return null;

    const endedAtMs = this.now();
    const record: SystemPerformanceRecord = {
      name,
      durationMs,
      startedAtMs: Math.max(0, endedAtMs - durationMs),
      endedAtMs,
      detail,
      startMark:
        typeof detail?.startMark === "string" ? detail.startMark : undefined,
      endMark: typeof detail?.endMark === "string" ? detail.endMark : undefined,
    };

    this.records.push(record);
    if (this.records.length > MAX_RECORDS) {
      this.records.splice(0, this.records.length - MAX_RECORDS);
    }
    return record;
  }

  public getMeasures(name?: string): SystemPerformanceRecord[] {
    const records = name
      ? this.records.filter((record) => record.name === name)
      : this.records;
    return records.map((record) => ({ ...record }));
  }

  public setDebugValue(key: string, value: unknown): void {
    if (!this.enabled) return;
    this.debugValues.set(key, value);
    this.installEditorDebugRuntime();
  }

  public clearDebugValue(key: string): void {
    this.debugValues.delete(key);
  }

  public registerSnapshotProvider(
    key: string,
    provider: () => unknown
  ): () => void {
    if (!this.enabled) return () => {};

    this.snapshotProviders.set(key, provider);
    this.installEditorDebugRuntime();
    return () => {
      this.snapshotProviders.delete(key);
    };
  }

  public snapshot(): SystemPerformanceSnapshot {
    const debug: Record<string, unknown> = {};

    for (const [key, value] of this.debugValues) {
      debug[key] = value;
    }

    for (const [key, provider] of this.snapshotProviders) {
      try {
        debug[key] = provider();
      } catch (error) {
        debug[key] =
          error instanceof Error ? { error: error.message } : { error };
      }
    }

    return {
      enabled: this.enabled,
      capturedAt: new Date().toISOString(),
      marks: Object.fromEntries(this.marks),
      measures: this.getMeasures(),
      debug,
    };
  }

  public clear(): void {
    this.activeTimers.clear();
    this.lastTimerId = null;
    this.marks.clear();
    this.records.length = 0;
  }

  private installEditorDebugRuntime(): void {
    if (!this.enabled || typeof window === "undefined") return;
    if (window.__REEL_EDITOR_DEBUG__) return;

    const runtime: ReelEditorDebugRuntime = {
      snapshot: () => this.snapshot(),
      clear: () => this.clear(),
      mark: (name, detail) => this.mark(name, detail),
      measure: (name, startMark, endMark, detail) =>
        this.measure(name, startMark, endMark, detail),
      start: (name, detail) => this.start(name, detail),
      stop: (timerIdOrLabel, detail) => this.stop(timerIdOrLabel, detail),
      getMeasures: (name) => this.getMeasures(name),
      setDebugValue: (key, value) => this.setDebugValue(key, value),
      registerSnapshotProvider: (key, provider) =>
        this.registerSnapshotProvider(key, provider),
    };

    window.__REEL_EDITOR_DEBUG__ = runtime;
  }

  private now(): number {
    return globalThis.performance?.now?.() ?? Date.now();
  }
}

export const systemPerformance = PerformanceSingleton.getInstance();

declare global {
  interface Window {
    __REEL_EDITOR_DEBUG__?: ReelEditorDebugRuntime;
  }
}
