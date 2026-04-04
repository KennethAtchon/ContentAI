# Plans Index

## Chat Drafts / Context

- [Plan 01: Persist Active Draft on Session](plan-01-persist-active-draft.md) - Persist `activeContentId` on `chat_session`, hydrate it safely in the client, and seed it when a session is created from an existing draft.
- [Plan 02: Session-Owned Draft Registry](plan-02-multi-draft-per-message.md) - Replace message-derived draft discovery with a real session-owned draft registry and make the session own both draft membership and the active draft pointer.
- [Plan 03: Session-Scoped Active Draft AI Context](plan-03-active-content-ai-context.md) - Build AI grounding from the session-owned draft set, validate active draft membership against the session, and move context into the system prompt.
- [Plan 04: Fix Draft Invalidation Race Condition](plan-04-invalidation-race.md) - Replace the one-shot invalidation with a retry/until-visible flow keyed by the streamed `contentId`.
- [Plan 05: Active Draft UX Rethink](plan-05-active-draft-ux.md) - Simplify draft activation UX once persistence is reliable and surface the active draft near the composer.

## Editor / Captions

- [Caption Track Init Plan](caption-track-init-plan.md) - Backend caption wiring for init, AI assemble, and merge flows; mostly implemented, with a few hardening follow-ups documented.
- [Editor Audit Fix Plan](editor-audit-fix-plan.md) - Historical editor audit backlog. Use the status snapshot at the top first; several originally planned fixes have already landed in the refactored editor architecture.
