# ADR-005: Use Bun as Package Manager and Test Runner

**Date:** Jan 2026  
**Status:** Accepted  
**Supersedes:** pnpm (used prior to Jan 2026)

## Context

The project originally used pnpm. Bun was maturing rapidly and offered significant performance improvements for both package management and test execution.

## Decision

Migrate from pnpm to **Bun** for:
- Package management (`bun install`, `bun add`)
- Script execution (`bun run`)
- Test running (`bun test`)

Next.js continues to use Node.js for the build and runtime (not Bun's Node.js compatibility layer).

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Stay on pnpm | Slower installs; no built-in test runner |
| npm | Even slower; no built-in test runner |
| Yarn Berry (PnP) | Complex; PnP compatibility issues with some packages |

## Consequences

- ✅ 2–5× faster `bun install` vs pnpm
- ✅ Built-in test runner (compatible with Jest-like API) — no separate Jest/Vitest needed
- ✅ Faster script execution
- ⚠️ Known Bun mock isolation bug in some test configurations (documented in test notes)
- ⚠️ Bun's Node.js compatibility is not 100% — some native Node.js APIs differ
- ⚠️ CI must use `oven-sh/setup-bun` action instead of standard Node.js setup
