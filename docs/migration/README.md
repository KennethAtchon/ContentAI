# Migration Plan: ContentAI → Viral Reel Studio

This folder documents the step-by-step plan for transforming the current SaaS template into the **AI-powered viral short-form content platform** described in `project.md`.

The target UI is the `AIStudioDesign.jsx` from `ui-shop/ui-content/reels-analyzer` — a dark, studio-grade interface built around discovering, analyzing, and remixing viral Instagram Reels.

---

## Files in This Folder

| File | Contents |
|------|----------|
| [01-overview.md](./01-overview.md) | What we're migrating from/to, what stays, what goes |
| [02-ui-shell.md](./02-ui-shell.md) | Implement the AIStudioDesign layout as the main app shell |
| [03-data-layer.md](./03-data-layer.md) | DB schema, API routes, reel data pipeline |
| [04-ai-analysis.md](./04-ai-analysis.md) | AI structural analysis — hook, emotion, format extraction |
| [05-content-generation.md](./05-content-generation.md) | AI generation engine — remix variations, caption, hook writer |
| [06-queue-publishing.md](./06-queue-publishing.md) | Queue system, scheduler, and posting pipeline |
| [07-cleanup.md](./07-cleanup.md) | Remove unused SaaS features from the template |

---

## Recommended Execution Order

```
01 → 07 → 02 → 03 → 04 → 05 → 06
```

Start with the overview to align on scope, strip the unused SaaS code early to reduce noise, then build forward from the UI shell through the data and AI layers.
