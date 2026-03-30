# Reorg Verification Checklist (Settled)

This file records the doc-vs-code verification and the concrete fixes applied so the backend and frontend reorg docs match the actual codebase.

## Backend

**Verified in code**

- `domain/` structure exists with feature services + repositories.
- `services/` contains infrastructure adapters only.
- Thin routes are in place for editor/admin/video/queue.
- Global `AppError` + `handleRouteError` wiring is active.
- Drizzle usage is routed through repositories; only `routes/health` imports `services/db/db`.
- Editor timeline validation and queue pipeline extraction exist.
- Video-generation providers live under `services/video-generation/`.

**Settled mismatches**

- Added editor Zod hook re-export for the doc path.  
  `backend/src/routes/editor/zod-validation-hook.ts`
- Added provider alias files to match naming in docs.  
  `backend/src/services/video-generation/providers/kling.ts`  
  `backend/src/services/video-generation/providers/ken-burns.ts`
- Updated `docs/BACKEND_REORGANIZATION.md` to reflect:
  - Export jobs handled in `domain/editor/editor.repository.ts`.
  - Types consolidation policy (types files where needed; repository exports otherwise).
  - Provider filename aliases.

## Frontend

**Verified in code**

- Context split (`auth-context`, `profile-context`) with `app-context` shim.
- Editor context usage across inspector/timeline/workspace.
- Admin list screens using shared `DataTable`.
- Chat SSE client extraction.
- Route loaders + shared query client.
- Payments redirect flow (fallback removed).

**Settled mismatches**

- App provider now composes `ThemeProvider` as documented.  
  `frontend/src/shared/contexts/app-provider.tsx`  
  `frontend/src/main.tsx` (wrapper removed)
- StudioTopBar now available from shared navigation path; imports updated.  
  `frontend/src/shared/components/navigation/StudioTopBar.tsx`
- Added shared Sentry entry point for doc alignment.  
  `frontend/src/shared/services/sentry.ts`
- Data-display now exposes `UsageMeter`, `TierBadge`, and `StatusBadge`.  
  `frontend/src/shared/components/data-display/UsageMeter.tsx`  
  `frontend/src/shared/components/data-display/TierBadge.tsx`  
  `frontend/src/shared/components/data-display/StatusBadge.tsx`
- Updated test location note in `docs/FRONTEND_REORGANIZATION.md`.

## Remaining Follow-ups

- None. Docs and code are aligned as of this checklist.
