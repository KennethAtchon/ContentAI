# Phase 7 LLD: Internal Package Wiring And Frontend Engine Integration

> **Parent HLD:** [../hld-editor.md](../hld-editor.md)
> **Status:** Draft
> **Goal:** Make `editor-core` and `contracts` real internal packages, then run the frontend editor directly on `editor-core` using a Docker/Railway shape that works with two separate services.

## 1. Purpose

Phase 5 completed Zustand wiring, autosave, and export UI flow, but it did **not** integrate `editor-core` as the browser editor engine. The current frontend still has zero imports from `editor-core`, `PreviewCanvas.tsx` is still a stub, and the current Docker build contexts (`./frontend`, `./backend`) are isolated in a way that blocks clean consumption of shared packages under `packages/`.

This phase fixes that by choosing one deployment model and wiring the repo around it.

**Chosen model:**

- Root Bun workspace at repo root.
- `packages/editor-core` and `packages/contracts` are both first-class internal packages.
- Frontend and backend depend on them via `workspace:*`.
- Docker builds use **repo-root context** with separate Dockerfiles for frontend and backend.
- Railway runs **two services/containers**:
  - frontend service using `frontend/Dockerfile`
  - backend service using `backend/Dockerfile`

No alias-only pseudo-package setup. No additional packaging option tree. This is the shape we implement.

## 2. Why This Is Needed

Current verified gaps:

- `packages/editor-core` has `src/index.ts` but no `package.json` and no `tsconfig.json`.
- `packages/contracts` has a minimal `package.json`, but the app still consumes it through direct tsconfig/Vite aliases instead of a unified workspace package model.
- `frontend/package.json` has no `editor-core` dependency.
- `frontend/src/domains/creation/editor/ui/preview/PreviewCanvas.tsx` still exposes no-op engine methods.
- Current Dockerfiles build from `./frontend` and `./backend` as isolated contexts, so shared packages under `packages/` are not part of the natural package/dependency boundary.

If we do not fix this now, the editor will keep drifting into three layers:

1. Canonical backend document shape.
2. App-local frontend editor model.
3. Unused `editor-core` engine code.

That is the opposite of the HLD goal.

## 3. Scope

**In scope:**

- Add repo-root workspace packaging.
- Add real package setup for `packages/editor-core`.
- Expand `packages/contracts` into the same package boundary model.
- Replace alias-based consumption with package-name imports where feasible.
- Make frontend editor runtime hydrate and mutate a core `Project`.
- Replace `PreviewCanvas` stub with a core-backed runtime bootstrap.
- Update Dockerfiles to build from repo root while still producing separate frontend/backend images.
- Update `docker-compose.yml` to mirror the package-aware build layout.
- Document Railway deployment using two services with separate Dockerfiles and shared repo context.

**Out of scope:**

- Publishing packages to npm.
- Real-time collaboration.
- Completing every pending editor feature like trim, duplicate, paste, or full undo history.
- Replacing the backend persistence decisions already made in earlier phases.

## 4. Architecture Decision

### 4.1 Package Model

The repo gets a root `package.json` with Bun workspaces:

```json
{
  "name": "contentai-monorepo",
  "private": true,
  "packageManager": "bun@1.2.14",
  "workspaces": [
    "frontend",
    "backend",
    "e2e",
    "automation",
    "packages/*"
  ]
}
```

This gives us one lockfile and one dependency graph. `frontend` and `backend` then consume internal packages through normal package resolution instead of source-path aliases.

### 4.2 Internal Packages In Scope

#### `@contentai/editor-core`

Create `packages/editor-core/package.json` and `packages/editor-core/tsconfig.json`.

`package.json` must declare:

- `name: "@contentai/editor-core"`
- `private: true`
- `type: "module"`
- explicit runtime dependencies actually imported by the package
- explicit `exports`

Recommended export surface:

```json
{
  "name": "@contentai/editor-core",
  "private": true,
  "type": "module",
  "exports": {
    "./types": "./src/types/index.ts",
    "./storage": "./src/storage/index.ts",
    "./actions": "./src/actions/index.ts",
    "./timeline": "./src/timeline/index.ts",
    "./playback": "./src/playback/index.ts",
    "./video": "./src/video/index.ts",
    "./media": "./src/media/index.ts",
    "./audio": "./src/audio/index.ts",
    "./graphics": "./src/graphics/index.ts",
    "./text": "./src/text/index.ts",
    "./effects": "./src/effects/index.ts",
    "./ai": "./src/ai/index.ts",
    "./utils": "./src/utils/index.ts"
  }
}
```

Do **not** rely on uncontrolled deep imports into `packages/editor-core/src/**` from app code once this phase is complete.

#### `@contentai/contracts`

Keep the existing package name, but bring it into the same workspace-driven model.

`packages/contracts` should also have its own `tsconfig.json`, and frontend/backend should consume it as a package dependency instead of a tsconfig/Vite alias.

### 4.3 Consumer Dependency Model

`frontend/package.json`:

```json
{
  "dependencies": {
    "@contentai/editor-core": "workspace:*",
    "@contentai/contracts": "workspace:*"
  }
}
```

`backend/package.json`:

```json
{
  "dependencies": {
    "@contentai/editor-core": "workspace:*",
    "@contentai/contracts": "workspace:*"
  }
}
```

Then remove package-path aliases for `@contracts` and do **not** add a source alias for `editor-core`.

### 4.4 Why Root Workspaces Are Required Here

For Railway, we need two independent Docker images, but both must be able to install shared internal packages from the same repo. Root workspaces solve that cleanly:

- one lockfile
- one package graph
- normal package resolution for internal packages
- no brittle `../packages/.../src` imports
- Docker builds can copy only the workspaces each service actually needs

This is the most reliable shape for two separate containers built from one repo.

## 5. Frontend Runtime Decision

The frontend editor runtime must stop treating Zustand as the editor engine.

Zustand remains for:

- selected clip / UI panels
- modal state
- save/export status
- viewport-only UI state

`editor-core` becomes the source of truth for:

- loaded project
- timeline semantics
- clip/track mutation rules
- playback timebase
- preview rendering lifecycle
- serialization boundary

### 5.1 Runtime Shape

Add a runtime facade such as:

`frontend/src/domains/creation/editor/runtime/editor-runtime.ts`

Responsibilities:

- hydrate `ProjectFile` / `Project` from backend response
- own core engine instances
- expose imperative methods to UI layer
- notify bridge/autosave after core mutations
- drive preview canvas lifecycle

Proposed flow:

```mermaid
flowchart LR
  Route[EditorRoutePage] --> Runtime[editor-runtime.ts]
  Runtime --> Core[@contentai/editor-core]
  Runtime --> UIStore[Zustand UI stores]
  Runtime --> Bridge[editor-bridge.ts]
  Bridge --> API[/api/editor]
```

### 5.2 App-Local Model Cleanup

`frontend/src/domains/creation/editor/model/editor-domain.ts` should not remain the runtime owner of `Track`, `Clip`, `Transition`, or `Project` semantics.

After this phase:

- core types come from `@contentai/editor-core/...`
- app-local types remain only for API envelope metadata, such as:
  - `saveRevision`
  - `generatedContentId`
  - `status`
  - `publishedAt`
  - `ExportJobStatus`

Add an adapter file for envelope-to-core conversion:

- `frontend/src/domains/creation/editor/bridge/project-adapter.ts`

This adapter is the only place where backend envelope fields and core project structures are merged.

### 5.3 Preview Canvas Cutover

`PreviewCanvas.tsx` must stop being a placeholder shell.

Replace the current no-op surface:

```ts
tick: () => undefined,
receiveFrame: () => undefined,
clearFrames: () => undefined,
```

with a real canvas/runtime bootstrap that:

- receives a core runtime instance
- registers the display canvas with the playback/render system
- advances playback from core timing
- renders frames from the core video/playback path

This is the first point where the browser editor actually starts using `editor-core` as an engine instead of just saving data in a similar shape.

## 6. Docker, Compose, And Railway

This phase must update the deployment/build layout as part of the implementation, not as a follow-up.

### 6.1 Docker Build Decision

Both service Dockerfiles stay separate, but **their build context changes to the repo root**.

Why:

- frontend image needs access to `packages/editor-core` and `packages/contracts`
- backend image needs access to `packages/contracts` and may need server-safe `editor-core` subpaths
- root workspace install requires the root `package.json` and root `bun.lock`

### 6.2 Frontend Dockerfile Changes

Keep the file at `frontend/Dockerfile`, but build it from repo root.

Expected compose/Railway build shape:

```yaml
build:
  context: .
  dockerfile: frontend/Dockerfile
```

Frontend Dockerfile implementation direction:

1. Copy root workspace files first:
   - `package.json`
   - `bun.lock`
2. Copy package manifests needed for install:
   - `frontend/package.json`
   - `packages/editor-core/package.json`
   - `packages/contracts/package.json`
3. Run workspace install from root.
4. Copy actual source for:
   - `frontend/`
   - `packages/editor-core/`
   - `packages/contracts/`
5. Build frontend from its workspace.
6. Copy built `frontend/dist` into nginx production stage.

Recommended build command:

```dockerfile
RUN bun run --cwd frontend build
```

### 6.3 Backend Dockerfile Changes

Keep the file at `backend/Dockerfile`, but also build from repo root.

Expected compose/Railway build shape:

```yaml
build:
  context: .
  dockerfile: backend/Dockerfile
```

Backend Dockerfile implementation direction:

1. Copy root workspace files first.
2. Copy package manifests needed for install:
   - `backend/package.json`
   - `packages/editor-core/package.json`
   - `packages/contracts/package.json`
3. Run workspace install from root.
4. Copy actual source for:
   - `backend/`
   - `packages/editor-core/`
   - `packages/contracts/`
5. Build backend from its workspace.
6. Production image should copy only the built backend output plus any runtime assets/scripts it actually needs.

Recommended build command:

```dockerfile
RUN bun run --cwd backend build
```

### 6.4 `docker-compose.yml` Changes

Local compose should mirror the same package-aware topology, not use a different install model than production.

#### Backend service

Change build section to:

```yaml
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile
    target: development
```

For dev volumes, mount shared packages too:

```yaml
volumes:
  - ./backend:/app/backend
  - ./packages:/app/packages
  - ./:/app/root
```

Exact mount paths may vary based on final workspace Docker layout, but the important requirement is that the running dev container can see the shared package workspaces.

#### Frontend service

Change build section to:

```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
    target: development
```

For dev volumes, mount shared packages too:

```yaml
volumes:
  - ./frontend:/app/frontend
  - ./packages:/app/packages
  - ./:/app/root
```

#### Compose rule

Compose is the local mirror of the Railway deployment shape. Do not keep a local-only Docker topology that bypasses workspaces while production uses them.

### 6.5 Railway Deployment Model

Railway should run **two services** from the same repo:

#### Frontend service

- Dockerfile path: `frontend/Dockerfile`
- Build context: repo root
- Exposed port: nginx/HTTP port from frontend image
- Runtime env includes:
  - `VITE_API_URL`
  - Firebase public config
  - app URL/public frontend env vars

#### Backend service

- Dockerfile path: `backend/Dockerfile`
- Build context: repo root
- Exposed port: backend service port
- Runtime env includes:
  - `DATABASE_URL`
  - `REDIS_URL`
  - auth/secrets/API keys
  - any export/runtime infra env vars

The key requirement is that Railway builds both services from the same repository root so each image can install the shared packages through the workspace graph.

## 7. Files To Create Or Modify

### 7.1 New files

- `package.json` (repo root)
- `bun.lock` (repo root, after workspace install)
- `packages/editor-core/package.json`
- `packages/editor-core/tsconfig.json`
- `packages/contracts/tsconfig.json`
- `frontend/src/domains/creation/editor/runtime/editor-runtime.ts`
- `frontend/src/domains/creation/editor/bridge/project-adapter.ts`

### 7.2 Update existing files

- `frontend/package.json`
- `backend/package.json`
- `e2e/package.json` if it imports shared packages directly
- `automation/package.json` if it imports shared packages directly
- `frontend/tsconfig.json`
- `backend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/Dockerfile`
- `backend/Dockerfile`
- `docker-compose.yml`
- editor bridge/store/runtime files under `frontend/src/domains/creation/editor/`

### 7.3 Remove after cutover

- direct alias-based `@contracts` path wiring
- app-local runtime ownership of editor timeline/domain shapes
- any remaining editor preview stubs that bypass core runtime

## 8. Implementation Order

### Step 1: Workspace foundation

- Add root workspace `package.json`.
- Move to root `bun.lock`.
- Add `packages/editor-core/package.json`.
- Add `packages/editor-core/tsconfig.json`.
- Add `packages/contracts/tsconfig.json`.
- Add workspace dependencies to frontend/backend.

### Step 2: Build system cutover

- Update frontend/backend Dockerfiles to root-context workspace builds.
- Update `docker-compose.yml` to use root build context and package-aware mounts.
- Validate local Docker dev still boots.

### Step 3: Package-consumption cutover

- Remove tsconfig/Vite alias dependency on `@contracts`.
- Replace editor-local imports with `@contentai/editor-core` and `@contentai/contracts` package imports.

### Step 4: Frontend engine cutover

- Add runtime facade.
- Hydrate core project through adapter.
- Move preview/playback to core runtime.
- Keep Zustand only for UI/session concerns.

### Step 5: Cleanup

- Delete obsolete app-local runtime type files.
- Remove preview stubs.
- Update remaining docs if file names or boundaries changed during implementation.

## 9. Validation Checklist

- [ ] Repo root has a workspace `package.json`.
- [ ] Repo root has the canonical `bun.lock` used by frontend and backend builds.
- [ ] `packages/editor-core/package.json` exists and declares explicit dependencies.
- [ ] `packages/contracts` is consumed as a workspace package, not only through path aliases.
- [ ] Frontend imports `@contentai/editor-core/...` by package name.
- [ ] Backend imports `@contentai/contracts` by package name and only safe `editor-core` subpaths if needed.
- [ ] `frontend/Dockerfile` builds successfully from repo root context.
- [ ] `backend/Dockerfile` builds successfully from repo root context.
- [ ] `docker-compose.yml` uses repo root context for frontend and backend builds.
- [ ] Railway can be configured as two services from the same repo with separate Dockerfiles.
- [ ] `PreviewCanvas.tsx` no longer contains engine no-op stubs.
- [ ] Opening a project hydrates a core `Project` and drives preview from `editor-core` runtime.

## 10. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| `editor-core` dependencies are incomplete in its new manifest | Builds will pass locally only by accident if consumers hoist missing deps | Audit every non-relative import inside `packages/editor-core/src` during package setup |
| Frontend keeps mirroring core state into React excessively | Re-render churn will come back in a different form | Keep core runtime external and subscribe narrowly from UI stores/components |
| Backend imports browser-heavy core modules accidentally | Server bundle may pull in DOM/Worker-only code | Restrict backend imports to approved core subpaths and review import boundaries |
| Docker local/prod shapes diverge again | Railway-only failures become likely | Make compose use the same root-context workspace build pattern as production |

## 11. Rollback

This phase is mostly packaging and runtime wiring. Rollback is code/config revert:

- remove workspace root package files
- revert consumer dependency changes
- revert Dockerfiles and compose to per-app isolated builds
- restore prior app-local editor runtime wiring if needed

No database migration is introduced by this phase alone.
