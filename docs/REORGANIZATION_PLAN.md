# Docs Reorganization Plan

This plan describes the proposed changes to the `docs/` folder: what moves, what gets deleted or archived, what gets rewritten, and why. Review this before any changes are made.

---

## 1. Current State: What's Wrong

### 1.1 Structural problems

**`AI_Orchestrator/` is a confusing name.**
This is an internal folder name that means nothing to a new developer. It hides important architecture docs behind a cryptic label and adds an unnecessary level of nesting. To read the API architecture doc you currently navigate: `docs/AI_Orchestrator/architecture/core/api.md` — four directories deep for a core doc.

**Too many hub/index files doing the same thing.**
There are four files whose main purpose is explaining where other files are:
- `AI_Orchestrator/index.md`
- `AI_Orchestrator/STRUCTURE.md`
- `AI_Orchestrator/architecture-guide.md`
- `AI_Orchestrator/overview.md` (partially)

These overlap heavily and are hard to keep in sync. One good README should replace all four.

**Empty and stale placeholder folders.**
- `AI_Orchestrator/issues/index.md` — 1 line, empty.
- `AI_Orchestrator/plantofix/index.md` — contains a leftover note about verifying the frontend/backend split, which is already done. `plantofix/nextjs-migration-plan.md` exists but the migration is complete.
- These folders add noise without value.

**`docs/scripts/` is in the wrong place.**
Three Docker helper shell scripts live in `docs/scripts/`. Documentation doesn't belong in the same folder as executable scripts. These should live at the repo root or alongside the relevant compose file.

### 1.2 Content problems

**`overview.md` is severely outdated.**
This is the most important doc in the folder — and it's wrong. It still describes a Next.js 15 monolith with Next.js App Router, `project/` as the source root, Next.js API routes, `Vitest` as the test runner, and `next-intl` for i18n. The project has since been migrated to:
- Frontend: React 19 SPA (Vite + TanStack Router) in `frontend/`
- Backend: Hono API server (Bun runtime) in `backend/`
- Test runner: Bun's built-in test runner (not Vitest)
- i18n: `react-i18next` (not `next-intl`)

**ADR-001 is superseded.**
`adr/ADR-001-nextjs-app-router.md` documents the decision to use Next.js App Router. Since the project moved away from Next.js entirely, this ADR's status should be updated to "Superseded."

**`consider/react-query-migration-guide.md` is stale.**
This was a plan to migrate from SWR to TanStack Query. That migration is complete. The file should be archived.

**`plantofix/nextjs-migration-plan.md` is stale.**
The Next.js → Vite+Hono migration is done. This plan should be archived.

**Paths throughout docs reference the old `project/` folder.**
Many files link to `project/shared/...`, `project/features/...`, `project/app/...`. All of these are wrong now. They should reference `frontend/src/...` or `backend/src/...`.

**`TEMPLATE_GUIDE.md` and `where-to-start-coding.md` reference the old Next.js structure.**
Both still point to `project/translations/en.json` (now `frontend/src/translations/en.json`), `project/shared/constants/app.constants.ts` (now `frontend/src/shared/constants/`), Next.js-specific patterns like `getTranslations()`, and so on.

---

## 2. Proposed New Structure

```
docs/
├── README.md                        # Single entry point (replaces index.md, STRUCTURE.md, architecture-guide.md)
├── TEMPLATE_GUIDE.md                # Keep — update all paths and Next.js references
├── where-to-start-coding.md         # Keep — update all paths and Next.js references
│
├── architecture/                    # Was: AI_Orchestrator/architecture/
│   ├── README.md                    # Architecture index (merged from old README + overview)
│   ├── overview.md                  # FULL REWRITE — current stack (Vite, Hono, Bun, etc.)
│   ├── diagrams.md                  # Rename from architecture-diagrams.md
│   │
│   ├── core/                        # Keep all 9 files — update path references only
│   │   ├── README.md
│   │   ├── api.md
│   │   ├── api-auth-context-pattern.md
│   │   ├── authentication.md
│   │   ├── code-structure.md
│   │   ├── database.md
│   │   ├── error-handling.md
│   │   ├── logging-monitoring.md
│   │   ├── performance.md
│   │   └── security.md
│   │
│   └── domain/                      # Keep all 5 files — update path references only
│       ├── README.md
│       ├── account-management.md
│       ├── admin-dashboard.md
│       ├── business-model.md
│       ├── calculator-system.md
│       └── subscription-system.md
│
├── adr/                             # Keep — update ADR-001 status to Superseded
│   ├── README.md
│   └── ADR-00*.md
│
├── runbooks/                        # Keep as-is (paths may need minor updates)
│   └── *.md
│
├── checklists/                      # Keep as-is (paths may need minor updates)
│   ├── README.md
│   └── *.md
│
├── troubleshooting/                 # Move from: AI_Orchestrator/troubleshooting/
│   ├── README.md
│   └── *.md
│
├── guides/                          # NEW folder — was: AI_Orchestrator/roles/ + AI_Orchestrator/consider/
│   ├── README.md                    # NEW — brief index of guides
│   ├── ai-roles/                    # Was: AI_Orchestrator/roles/
│   │   ├── code-organization-expert.md
│   │   ├── core-feature-swap-expert.md
│   │   ├── security-engineer.md
│   │   └── UI-design-expert.md
│   └── proposals/                   # Was: AI_Orchestrator/consider/ (rename from "consider")
│       ├── e2e-testing-plan.md
│       ├── graphql-architecture.md
│       ├── owasp-top10-review.md
│       ├── production-readiness.md
│       └── testing-implementation-plan.md
│
└── archive/                         # Collect completed/stale docs
    ├── README.md                    # Brief note: "These docs are archived"
    ├── security-audit-tickets.md    # Was: AI_Orchestrator/graveyard/
    ├── nextjs-migration-plan.md     # Was: AI_Orchestrator/plantofix/ (migration complete)
    ├── react-query-migration-guide.md # Was: AI_Orchestrator/consider/ (already done)
    └── testing-100-coverage-plan.md # Was: AI_Orchestrator/consider/ (evaluate if needed)
```

**What is removed entirely:**
- `AI_Orchestrator/` directory (contents redistributed as above)
- `AI_Orchestrator/index.md` — replaced by `docs/README.md`
- `AI_Orchestrator/STRUCTURE.md` — replaced by `docs/README.md`
- `AI_Orchestrator/architecture-guide.md` — consolidated into `docs/README.md`
- `AI_Orchestrator/issues/` — was empty; deleted
- `AI_Orchestrator/plantofix/index.md` — stale placeholder; deleted (plan itself moved to archive)
- `docs/scripts/` — moved out of docs (to repo root or deleted; covered below)

---

## 3. File-by-File Change Log

### New files to create

| File | Action | Notes |
|------|--------|-------|
| `docs/README.md` | Create new | Single entry point. Replaces `index.md`, `STRUCTURE.md`, and `architecture-guide.md`. Short, scannable: what's in each folder, quick links by role (new dev, developer, architect). |
| `docs/guides/README.md` | Create new | Brief index for the guides folder (AI roles + proposals). |
| `docs/archive/README.md` | Create new | One-paragraph note explaining this folder holds completed plans and archived decisions. |

### Files to rewrite completely

| File | Why |
|------|-----|
| `docs/architecture/overview.md` (was `AI_Orchestrator/overview.md`) | Completely wrong stack. Remove all Next.js, `project/`, Vitest, next-intl references. Rewrite to describe: Vite+React frontend, Hono+Bun backend, TanStack Router, react-i18next, Bun test runner, Prisma, Firebase, Stripe, Redis, Prometheus. |
| `docs/TEMPLATE_GUIDE.md` | All `project/` paths wrong. All Next.js patterns wrong (getTranslations, next-intl, Next.js API routes). Rewrite affected sections to use `frontend/src/` and `backend/src/` paths and correct patterns. |
| `docs/where-to-start-coding.md` | Same issue — `project/` paths, `next-intl` patterns, Next.js-specific commands. Update to current structure. |

### Files to update (paths/references only)

| File | What to update |
|------|---------------|
| `docs/adr/README.md` | Remove "YourApp" from title. |
| `docs/adr/ADR-001-nextjs-app-router.md` | Change status to **Superseded**. Add note: "Superseded by migration to Vite + TanStack Router (frontend) and Hono (backend) in 2026." |
| `docs/architecture/core/*.md` | Update any `project/` path references to `frontend/src/` or `backend/src/`. Update Vitest→Bun, next-intl→react-i18next where mentioned. |
| `docs/architecture/domain/*.md` | Same path updates. |
| `docs/checklists/*.md` | Update `project/shared/...` path references. |
| `docs/runbooks/*.md` | Minor updates if they reference the old folder structure. |
| `docs/troubleshooting/*.md` | Update any path references. |

### Files to move (no content changes)

| From | To |
|------|----|
| `docs/AI_Orchestrator/architecture/core/` | `docs/architecture/core/` |
| `docs/AI_Orchestrator/architecture/domain/` | `docs/architecture/domain/` |
| `docs/AI_Orchestrator/architecture/architecture-diagrams.md` | `docs/architecture/diagrams.md` |
| `docs/AI_Orchestrator/troubleshooting/` | `docs/troubleshooting/` |
| `docs/AI_Orchestrator/roles/` | `docs/guides/ai-roles/` |
| `docs/AI_Orchestrator/graveyard/security-audit-tickets.md` | `docs/archive/security-audit-tickets.md` |

### Files to archive (move to `docs/archive/`)

| File | Reason |
|------|--------|
| `AI_Orchestrator/plantofix/nextjs-migration-plan.md` | Migration complete. Archive for reference. |
| `AI_Orchestrator/consider/react-query-migration-guide.md` | Migration complete. Archive for reference. |
| `AI_Orchestrator/consider/testing-100-coverage-plan.md` | Evaluate: keep as `proposals/` if still relevant, otherwise archive. |

### Files to delete entirely

| File | Reason |
|------|--------|
| `docs/AI_Orchestrator/index.md` | Replaced by `docs/README.md`. |
| `docs/AI_Orchestrator/STRUCTURE.md` | Replaced by `docs/README.md`. |
| `docs/AI_Orchestrator/architecture-guide.md` | Consolidated into `docs/README.md`. |
| `docs/AI_Orchestrator/issues/index.md` | Was empty (1 line). |
| `docs/AI_Orchestrator/plantofix/index.md` | Stale placeholder. |
| `docs/template-roadmap.md` | Consider moving into `docs/guides/` or merging key content into `TEMPLATE_GUIDE.md`. Most of its checklist is already completed — the "double-check" and "templatization audit" sections can move to `archive/`. |

### `docs/scripts/` folder

These three Docker helper shell scripts do not belong in a documentation folder:
- `docs/scripts/run-docker.sh`
- `docs/scripts/run-docker-minimal.sh`
- `docs/scripts/nuke-docker.sh`

**Proposed action:** Move to repo root `scripts/` directory (next to `docker-compose.yml`), or into `backend/scripts/` if they're backend-specific. Delete `docs/scripts/` entirely.

---

## 4. Content Rewrite Details

### `docs/README.md` (new)

Replace three overlapping hub files with one clear entry point:

```
- What this template gives you (3 bullets max)
- Quick start (clone → env → run)
- Where to find things (table: folder → purpose → when to use it)
- Reading paths by role: New developer / Developer / Architect
```

No duplicate content. Links out to detailed docs. Stays short enough to read in 2 minutes.

---

### `docs/architecture/overview.md` (full rewrite)

Current file (260+ lines) describes the wrong project. The rewrite should:

1. **Correct the tech stack table:**
   - Frontend: React 19, Vite, TanStack Router, TanStack Query, react-i18next, Tailwind v4, Firebase client SDK
   - Backend: Hono, Bun runtime, Prisma, PostgreSQL, Redis, Firebase Admin, Stripe, Resend, Prometheus
   - Test runner: Bun (not Vitest)

2. **Correct the folder structure:**
   ```
   WebsiteTemplate2/
   ├── frontend/          (React SPA)
   │   └── src/
   │       ├── routes/    (file-based routing)
   │       ├── features/
   │       └── shared/
   ├── backend/           (Hono API server)
   │   └── src/
   │       ├── routes/    (mounted at /api/<resource>)
   │       ├── middleware/
   │       └── infrastructure/
   └── e2e/               (Playwright E2E tests)
   ```

3. **Correct the architecture diagram:** Remove the Next.js monolith diagram. Replace with a client-server diagram showing the React SPA calling the Hono API.

4. **Correct the API routes section:** Remove all the old Next.js `/api/*` route descriptions. Describe the Hono routes as they exist in `backend/src/routes/`.

5. **Correct the dev setup commands:**
   - Frontend: `cd frontend && bun dev` (port 3000)
   - Backend: `cd backend && bun dev` (port 3001)
   - Not: `cd project && bun run dev`

6. **Remove dead references:** Remove all links to files that no longer exist (e.g., `./architecture/application-architecture.md`, `./architecture/system-architecture.md`, etc. — none of these exist in the current docs).

---

### `docs/TEMPLATE_GUIDE.md` (targeted updates)

The overall structure is good and should be preserved. Update specific sections:

- **Section 1 (5-minute version):** Update `cd your-project/project` → correct paths; update `bun run db:generate` / `bun run db:migrate` to note these run from `backend/`.
- **Section 2 (What's already built):** Update all `project/features/...` paths to `frontend/src/features/...`; update `project/app/api/...` to `backend/src/routes/...`.
- **Section 3 (Project layout):** Replace the old `project/` tree with the new `frontend/` + `backend/` tree.
- **Section 4 (Where to make it yours):**
  - Step 1: Update path `project/shared/constants/app.constants.ts` → `frontend/src/shared/constants/app.constants.ts`
  - Step 2: Update `project/translations/en.json` → `frontend/src/translations/en.json`; replace `next-intl` / `useTranslations()` with `react-i18next` / `useTranslation()`
  - Step 3: Update env var section to reflect separate frontend `.env` and backend `.env`
- **Section 7 (Documentation map):** Update all `AI_Orchestrator/` paths to new `architecture/` paths.

---

### `docs/adr/ADR-001-nextjs-app-router.md` (status update)

Add at the top:

```
**Status: Superseded**

Superseded in 2026 by migration to Vite + TanStack Router (frontend) and Hono + Bun (backend).
The Next.js App Router was removed entirely. See architecture/overview.md for the current stack.
```

---

## 5. Summary: Before vs After

| Before | After |
|--------|-------|
| 4 overlapping hub/index files | 1 `docs/README.md` |
| `AI_Orchestrator/` (cryptic name, deep nesting) | `architecture/` (clear name, 2 levels deep) |
| `overview.md` describing Next.js 15 monolith | `overview.md` describing actual current stack |
| `consider/` folder (vague name) | `guides/proposals/` (clear name) |
| `graveyard/`, `issues/`, `plantofix/` (mostly empty/stale) | `archive/` (one consolidated folder) |
| Scripts buried in `docs/scripts/` | Moved to repo root `scripts/` |
| ADR-001 status: Accepted (for Next.js) | ADR-001 status: Superseded |
| `project/` paths throughout | `frontend/src/` and `backend/src/` paths |
| ~80+ docs files with significant overlap | ~55 files, each with a clear purpose |

---

## 6. What Stays the Same

- `docs/adr/` — ADRs 002-008 are accurate and useful.
- `docs/runbooks/` — All 15 runbooks are valid operational docs; keep all.
- `docs/checklists/` — All 7 checklists are valid; keep all.
- `docs/architecture/core/` — All 9 files are well-written and current; move only.
- `docs/architecture/domain/` — All 5 files are accurate; move only.
- `docs/troubleshooting/` — All 4 files are useful; move only.
- `docs/guides/ai-roles/` — Role definitions are still useful; move only.
- The `TEMPLATE_GUIDE.md` structure — good content, needs path/framework updates only.

---

## 7. Order of Operations (when implementing)

1. Create new folder structure (`architecture/`, `guides/`, `archive/`, `troubleshooting/` at root level)
2. Move files that need no content changes
3. Create new `docs/README.md`
4. Rewrite `architecture/overview.md`
5. Update `TEMPLATE_GUIDE.md` (targeted section updates)
6. Update `where-to-start-coding.md`
7. Update ADR-001 status
8. Update path references in `core/` and `domain/` docs
9. Move scripts out of `docs/scripts/`
10. Delete old `AI_Orchestrator/` directory

---

*This plan was written 2026-03-06. Review and approve before implementation.*
