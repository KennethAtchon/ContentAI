import { createContext, useContext } from "react";

/**
 * PlayheadClock is a non-React object that owns the live playhead position.
 * It fires imperative callbacks on every update — no React state, no re-renders.
 *
 * The PreviewEngine's RAF loop calls clock.update() at 60fps during playback.
 * UI elements (Playhead line, timecode labels) subscribe and update their DOM
 * directly. React state only reflects the playhead when playback stops.
 */
export class PlayheadClock {
  private readonly listeners = new Set<(ms: number) => void>();
  private ms = 0;

  update(ms: number): void {
    this.ms = ms;
    for (const fn of this.listeners) fn(ms);
  }

  subscribe(fn: (ms: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getTime(): number {
    return this.ms;
  }
}

export const PlayheadClockContext = createContext<PlayheadClock | null>(null);

export function usePlayheadClock(): PlayheadClock {
  const clock = useContext(PlayheadClockContext);
  if (!clock) throw new Error("usePlayheadClock must be used inside EditorProviders");
  return clock;
}
