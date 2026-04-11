# Frontend Optimization Tools

Four tools are configured in the frontend to analyze and improve performance. This guide covers how to run each one and what to do with the output.

---

## 1. react-scan — Re-render Visualizer

**What it does:** Draws a colored overlay on components that re-render. The more a component re-renders, the more intense the highlight. Catches unnecessary re-renders caused by unstable references, missing memoization, or prop drilling.

**How to run:**

```bash
cd frontend
bun dev
```

It activates automatically in dev mode — no extra command needed. Open the app in the browser and interact with it. Watch for components that flash repeatedly when they shouldn't.

**What to look for:**

- Components that highlight on every keystroke or scroll when their output hasn't changed
- Parent components that highlight because a child changed — may indicate state is too high in the tree
- List items that all re-render when only one item changes

**How to fix common issues:**

| Symptom | Fix |
|---------|-----|
| Component re-renders on every parent render | Wrap with `React.memo` |
| Object/array prop recreated each render | Wrap with `useMemo` |
| Callback prop recreated each render | Wrap with `useCallback` |
| Context triggers all consumers | Split context or use selector pattern |

**Note:** react-scan only runs in development (`import.meta.env.DEV`). It is excluded from production builds automatically.

---

## 2. rollup-plugin-visualizer — Bundle Size Treemap

**What it does:** Generates an interactive HTML treemap showing every module in the production bundle, how large it is, and which chunk it belongs to. Helps identify oversized dependencies or modules that should be code-split.

**How to run:**

```bash
cd frontend
bun run bundle-analyze
```

This runs a production build and automatically opens `dist/bundle-stats.html` in your browser.

**Reading the treemap:**

- Each rectangle is a module. Larger rectangle = larger size contribution.
- Colors group modules by chunk.
- Hover over a rectangle to see the exact file path and sizes (raw, gzip, brotli).

**What to look for:**

- Vendor chunks that are unexpectedly large (e.g. a date library bringing in a full locale set)
- Modules appearing in multiple chunks (duplicated code)
- Large dependencies that are only used in one route but not lazy-loaded
- Dev-only packages that accidentally made it into the bundle

**How to fix common issues:**

| Symptom | Fix |
|---------|-----|
| Large library used in one route | Lazy-load the route with `React.lazy` |
| Duplicate module across chunks | Add it to `manualChunks` in `vite.config.ts` |
| Unused exports from a package | Check if the package supports tree-shaking; import specifically |
| Icons library is huge | Import only used icons, not the full set |

---

## 3. Million.js Compiler — Component Optimization Hints

**What it does:** The Million.js Vite plugin (`auto: true`) runs during dev and build. It analyzes your React components and automatically converts eligible ones to use Million's faster virtual DOM. When it can't optimize a component, it logs a warning in the terminal explaining why.

**How to run:**

```bash
cd frontend
bun dev
```

Optimization feedback appears in the terminal during startup and when files change. During a build:

```bash
bun run build
```

The compiler output lists which components were optimized and which were skipped with reasons.

**What the warnings mean:**

| Warning | Meaning |
|---------|---------|
| `Component uses hooks` | Million skips hook-heavy components — this is expected |
| `Dynamic children` | Component renders variable child lists — not optimizable automatically |
| `Spread props` | Props spread (`{...props}`) prevents static analysis |

**What to do:** Most warnings are informational. If a hot-path component (one that renders hundreds of times, e.g. a list item) is flagged, consider restructuring it to be eligible — extract the dynamic parts into a separate child component.

---

## 4. eslint-plugin-react-hooks — Static Hook Analysis

**What it does:** Catches violations of the Rules of Hooks at lint time, before the code runs. Errors on illegal hook calls (hooks inside conditions, loops, or non-component functions).

**How to run:**

```bash
cd frontend
bun run lint
```

**Rules active:**

| Rule | Level | What it catches |
|------|-------|-----------------|
| `react-hooks/rules-of-hooks` | error | Hook called conditionally, in a loop, or outside a component |
| `react-hooks/exhaustive-deps` | off | Missing dependency array entries (disabled — enable to tighten) |

**Enabling exhaustive-deps (optional but recommended):**

In `eslint.config.mjs`, change:

```js
"react-hooks/exhaustive-deps": "off",
```

to:

```js
"react-hooks/exhaustive-deps": "warn",
```

This surfaces stale closure bugs where a `useEffect` or `useCallback` captures an outdated value because a dependency was omitted.

---

## Quick Reference

| Goal | Command |
|------|---------|
| Find unnecessary re-renders | `bun dev` → open browser → interact with UI |
| Audit bundle size | `bun run bundle-analyze` |
| Check Million optimization coverage | `bun dev` or `bun run build` → read terminal output |
| Catch hook violations statically | `bun run lint` |
