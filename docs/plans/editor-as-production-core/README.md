# Plan: Editor as Production Core

**Status:** Design complete — ready for implementation
**Date:** 2026-03-22

The editor becomes the single production system. All assets flow into the editor timeline. The final video is produced exclusively by exporting from the editor.

## Documents

| File | Purpose |
|---|---|
| [`00-context-and-problems.md`](./00-context-and-problems.md) | Full diagnosis of the current broken state — why the timeline is empty, why assembled_video appears as source media, the two disconnected pipelines |
| [`HLD.md`](./HLD.md) | High-level design — system context, core design decisions, data flow diagrams, what is removed |
| [`LLD.md`](./LLD.md) | Low-level design — schema changes, all service implementations with code, frontend changes, build sequence, edge cases |

## One-Line Summary per Phase

| Phase | What changes |
|---|---|
| 1 | Editor title = content hook. Placeholder clips in timeline from day one. `autoTitle` schema. |
| 2 | Clip generation writes to timeline directly. Auto-assembly deleted. |
| 3 | Editor UI shows placeholder slots. Timeline polls for clip arrivals. "Generate Clips" button. |
| 4 | Queue pipeline stages updated to reflect editor-centric flow. |
