# Plans Index

## Chat Drafts / Context

- [Plan 01: Persist Active Draft on Session](plan-01-persist-active-draft.md) - Persist `activeContentId` on `chat_session`, hydrate it safely in the client, and seed it when a session is created from an existing draft.
- [Plan 02: Multi-Draft Per Message](plan-02-multi-draft-per-message.md) - Add a junction table for assistant-message-to-draft fanout without breaking the existing `generatedContentId` compatibility path during rollout.
- [Plan 03: Active Content ID - Full AI Context](plan-03-active-content-ai-context.md) - Move active-draft grounding into the system prompt and send a fuller structured snapshot of the active artifact.
- [Plan 04: Fix Draft Invalidation Race Condition](plan-04-invalidation-race.md) - Replace the one-shot invalidation with a retry/until-visible flow keyed by the streamed `contentId`.
- [Plan 05: Active Draft UX Rethink](plan-05-active-draft-ux.md) - Simplify draft activation UX once persistence is reliable and surface the active draft near the composer.

## Editor / Captions

- [Caption Track Init Plan](caption-track-init-plan.md) - Backend caption wiring for init, AI assemble, and merge flows; mostly implemented, with a few hardening follow-ups documented.
- [Editor Audit Fix Plan](editor-audit-fix-plan.md) - Historical editor audit backlog. Use the status snapshot at the top first; several originally planned fixes have already landed in the refactored editor architecture.
