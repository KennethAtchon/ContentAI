## User preferences (`/api/customer/settings`)

This document explains **per-user defaults** stored in PostgreSQL: why they exist alongside **global** AI and video configuration, how reads and writes behave, and how the **“defaults”** helper endpoints support the UI without duplicating business logic in the client.

---

## Table of contents

1. [Why two layers: system vs user](#why-two-layers-system-vs-user)
2. [Schema and storage](#schema-and-storage)
3. [Semantics of `null` and `system_default`](#semantics-of-null-and-system_default)
4. [GET and PUT `/api/customer/settings`](#get-and-put-apicustomersettings)
5. [DELETE `/api/customer/settings` (reset)](#delete-apicustomersettings-reset)
6. [GET `/api/customer/settings/ai-defaults`](#get-apicustomersettingsai-defaults)
7. [GET `/api/customer/settings/video-defaults`](#get-apicustomersettingsvideo-defaults)
8. [How feature code should resolve “effective” settings](#how-feature-code-should-resolve-effective-settings)
9. [Security and consistency](#security-and-consistency)
10. [Tradeoffs and pitfalls](#tradeoffs-and-pitfalls)

---

## Why two layers: system vs user

**Global configuration** (see [AI Provider System](./ai-provider-system.md)) answers: *What providers are enabled? Which API keys? Which models for analysis vs generation? What is the platform’s default video provider?* That data is **admin-controlled**, often **encrypted at rest** for secrets, **cached in Redis** for performance, and changes affect **all users** unless overridden.

**User preferences** answer: *Given the platform supports Kling and Runway, **which one do I prefer**? Which voice do I usually use? Do I default to 9:16?* Those choices are **cheap to store**, **safe to expose** to the owning user, and **do not require** a redeploy or admin action.

**Why not put everything in Firebase custom claims?**

Claims are great for **small, security-sensitive, read-everywhere** data (e.g. `stripeRole`), but they are **size-limited**, **sticky until token refresh**, and **awkward to query in bulk**. User prefs are **relational**, may grow, and should update without forcing token churn. Postgres + a `user_settings` row is the right fit.

**Why not only use `system_config` with per-user keys?**

`system_config` is designed as a **flat key/value store for the whole deployment**. Namespacing every user under it would blur admin vs user authority, complicate caching, and make migrations painful. A dedicated **`user_settings`** table with a **unique `user_id`** keeps concerns separated.

---

## Schema and storage

Table: **`user_settings`** (`backend/.../schema.ts`)

| Column | Role |
|--------|------|
| `id` | UUID PK |
| `user_id` | FK → `users.id`, **unique** — at most one settings row per user |
| `preferred_ai_provider` | Nullable string enum in API layer |
| `preferred_video_provider` | Nullable string enum in API layer |
| `preferred_voice_id` | Nullable (ElevenLabs / catalog id) |
| `preferred_tts_speed` | Nullable (`slow` / `normal` / `fast`) |
| `preferred_aspect_ratio` | Nullable (`9:16` / `16:9` / `1:1`) |
| `created_at` / `updated_at` | Audit / UI “last changed” potential |

**On user delete:** FK is `onDelete: cascade` — when a `users` row is removed, settings disappear with it. No orphan preference rows.

---

## Semantics of `null` and `system_default`

**In the database, “follow platform default” is represented as SQL `NULL`** on each nullable column.

The **PUT** handler accepts JSON where the client may send the string **`"system_default"`** for any field. The route maps that to **`null`** before calling `userSettingsService.upsert`. **Why?**

- Frontend dropdowns often want a **visible option** labeled “System default” that is not confused with “missing key.”
- Using a sentinel string in JSON avoids ambiguous tri-state (`undefined` vs `null`) across serializers.

**`undefined` / omitted keys in PUT:** The service layer only applies **defined** fields in the `onConflictDoUpdate` set clause — omitted preferences are left unchanged. That allows **partial updates** without wiping other columns.

---

## GET and PUT `/api/customer/settings`

**GET `/`**

- Returns the full row for `auth.user.id`, or a minimal `{ userId }` payload when no row exists yet (implicit “all defaults”).
- **Read-only** — no CSRF.

**PUT `/`**

- Body validated with Zod; only known keys accepted.
- **`userSettingsService.upsert`**:
  - **Insert** on first use: `insert ... values (userId, ...fields)`.
  - **Conflict on `user_id`**: `onConflictDoUpdate` updates **only the fields present in the request** and bumps `updated_at`.

**Why upsert instead of separate create?**

From the client’s perspective there is only “save my preferences.” Forcing a `POST /settings` then `PUT` would race on double tabs and complicate the app. Upsert is **idempotent** and matches “ensure row exists.”

---

## DELETE `/api/customer/settings` (reset)

**DELETE `/`**

- Sets **all** preference columns to **`NULL`** (and `updated_at` now) for the user row.
- Does **not** remove the row (harmless either way; NULL columns == defaults).

**Why keep the row?**

Simplifies subsequent PUTs (always same code path). Empty row vs missing row is normalized at read time in GET if you choose to return defaults-only for all-null rows in the future.

---

## GET `/api/customer/settings/ai-defaults`

This endpoint is **not** “user prefs + labels.” It computes **read-only metadata** for **whatever the platform would use if the user picked “system default”** for AI:

- Loads **enabled providers** from the async AI config layer (`getEnabledProvidersAsync`).
- Picks the **first enabled** provider as `defaultProvider`.
- Resolves **analysis** and **generation** model strings for that provider via `getModelForProviderAsync`.
- Derives **`supportsVision`** and **`contextWindow`** with **heuristic** string matching on model ids (for UI badges / tooltips — **not** a guarantee from provider APIs).

**Why a separate endpoint?**

- Keeps **one source of truth** for “what is default today” when admins change `system_config`.
- Avoids duplicating provider registry knowledge in the frontend (which would drift).

**Caveat:** Heuristics can be wrong for new model names until updated. Treat as **UX hints**, not authorization.

---

## GET `/api/customer/settings/video-defaults`

Returns **`defaultProvider`** and **`defaultProviderLabel`** for **video generation**, based on:

- **`system_config`** value for default video provider (e.g. `kling-fal`).
- **Runtime availability** — each provider’s `isAvailable()` (API keys, feature flags).

If the configured default is **unavailable**, the code **falls through to the first available** provider in a fixed list order. **Why?**

- Prevents the UI from advertising a provider that would **fail on first job**.
- Matches the “effective default” mental model for new users.

**This is still “system” scope** — user `preferred_video_provider` is **not** merged here in the handler; merging belongs in the feature that **starts a video job** (server should prefer user override when set and available, else this effective default).

---

## How feature code should resolve “effective” settings

Recommended precedence (document this in code comments where implemented):

1. **User setting** if non-null **and** still valid (provider enabled, voice still in catalog).
2. **System default** from `system_config` + availability checks.
3. **Hard fallback** (last resort) documented in the video/AI module.

**Invalid user prefs** (e.g. admin disabled a provider) should **fall back silently** with optional UI toast — don’t 500 user flows for stale preferences.

---

## Security and consistency

- All routes: **`authMiddleware("user")`** — only the owning user.
- Mutations: **`csrfMiddleware()`** — same pattern as profile and orders.
- **No secrets** in `user_settings` — safe to return on GET to the owner.
- **Rate limit:** `rateLimiter("customer")`.

---

## Tradeoffs and pitfalls

- **No versioning field** — if enum values change (`kling-fal` renamed), old rows may hold legacy strings; migration or read-time mapping may be needed.
- **No audit log** — who changed voice preference when? If compliance requires it, add append-only audit or log structured events on PUT.
- **Split brain with admin** — disabling a provider does not auto-clear user prefs; resolution logic must handle that (see above).

---

## Related documentation

- [AI Provider System](./ai-provider-system.md)
- [Reel generation](./reel-generation-system.md) (video providers)
- [Audio & TTS](./audio-tts-system.md) (voice / speed)
- [Account management](./account-management.md)
- [Subscription / tier limits](./business-model.md) (prefs do not bypass limits)
