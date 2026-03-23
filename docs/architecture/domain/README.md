# Domain Architecture

## Overview

ContentAI (ReelStudio) is an AI-powered short-form video creation platform. Users discover viral reels, analyze what makes them work, generate remixed content using AI, produce voiceovers, generate video clips, assemble final videos, and schedule them for publishing.

**Core domain areas:**

| Area | What it covers |
|---|---|
| [Business Model](./business-model.md) | Subscription tiers, pricing, usage limits, payment flows |
| [Subscription System](./subscription-system.md) | Firebase Stripe Extension, lifecycle, custom claims, usage tracking |
| [Studio System](./studio-system.md) | Discover → Analyze → Generate → Queue workspace |
| [Generation System](./generation-system.md) | Reel analysis (Claude Haiku) + content generation (Claude Sonnet) |
| [Chat Streaming System](./chat-streaming-system.md) | AI chat with SSE streaming, tool calls, draft creation |
| [Reel Generation System](./reel-generation-system.md) | Video clip generation + FFmpeg assembly pipeline |
| [Manual Editor System](./manual-editor-system.md) | Timeline editor, compositions, render jobs |
| [Audio & TTS System](./audio-tts-system.md) | ElevenLabs voiceover generation, voice catalog, trending audio |
| [Music Library System](./music-library-system.md) | Background music tracks, admin uploads, user browsing |
| [Projects System](./projects-system.md) | User workspaces grouping chat sessions and generated content |
| [AI Provider System](./ai-provider-system.md) | Registry-based multi-provider AI with DB-backed config + fallback |
| [Admin Dashboard](./admin-dashboard.md) | Metrics, customer/order/subscription management, niche/music admin |
| [Account Management](./account-management.md) | Profile, subscription, usage dashboard |
| [Video Playback](./contentai-video-playback-technical-deep-dive.md) | R2 mirroring, signed URL generation, fallback |
| [User-Uploaded Media](./user-uploaded-media-system.md) | Personal library: `GET/POST/DELETE /api/media`, R2, signed URLs |
| [Content-Scoped Assets](./content-assets-system.md) | Assets linked to `generatedContent`: `/api/assets` list, upload, patch, delete |
| [User Preferences](./user-preferences-system.md) | Per-user AI/video/voice defaults: `/api/customer/settings` |
| [Shared & Public API](./shared-public-api.md) | Contact form, confirmation email, authenticated image upload: `/api/shared` |
| [Client Analytics](./client-analytics-endpoints.md) | Browser telemetry logged on the server: `/api/analytics` |

**Cross-cutting (not duplicated here):** [Authentication & registration](../core/authentication.md) — Firebase + `POST /api/auth/register` for Postgres upsert.

---

## System Map

```
User
├── /studio/*              Studio workspace (protected)
│   ├── /discover          Browse viral reels by niche
│   ├── /generate          Generate content from a reel
│   ├── /queue             Content pipeline dashboard
│   └── /editor/:id        Manual timeline editor
│
├── /chat                  AI chat workspace
│   └── sessions/:id       Chat with tool calls (save/iterate drafts)
│
├── /(customer)/account    Subscription, profile, usage
├── /(customer)/checkout   Stripe checkout flow
│
└── /admin/*               Admin-only management
    ├── /dashboard         MRR, users, churn metrics
    ├── /customers         User management
    ├── /orders            Order management
    ├── /subscriptions     Subscription analytics
    ├── /niches            Niche + scrape management
    ├── /music             Background music library
    ├── /developer         AI provider + system config
    └── /settings          Admin profile
```

---

## Content Pipeline

A typical content creation session flows through these systems:

```
1. Discover reel  → Studio System (GET /api/reels)
2. Analyze reel   → Generation System (POST /api/reels/:id/analyze → Claude Haiku)
3. Generate copy  → Generation System (POST /api/generation → Claude Sonnet)
          OR
   Chat + AI      → Chat Streaming System (POST /api/chat/sessions/:id/messages)
4. Generate voice → Audio & TTS System (POST /api/audio/tts → ElevenLabs)
5. Generate clips → Reel Generation System (POST /api/video/reel → Kling/Runway)
6. Assemble video → Reel Generation System (POST /api/video/assemble → FFmpeg)
7. Manual edit    → Manual Editor System (/studio/editor/:id)
8. Schedule post  → Studio System / Queue (PATCH /api/queue/:id)
```

---

## Data Model Relationships

```
project
  └── chatSession (many)
        └── chatMessage (many)
              └── generatedContent (optional link)

generatedContent
  ├── reelAsset (many) — video clips, voiceovers, music, assembled video
  ├── reelComposition (1:1 optional) — manual editor state
  ├── queueItem (1:1 optional) — scheduling state
  └── videoJob (many) — async generation/assembly jobs

reel
  └── reelAnalysis (1:1 optional)
```

---

## How to Use This Documentation

- **Adding a feature to the generation pipeline?** Start with [Generation System](./generation-system.md)
- **Adding a new AI provider?** See [AI Provider System](./ai-provider-system.md)
- **Changing subscription tiers or limits?** See [Business Model](./business-model.md)
- **Touching the video assembly pipeline?** See [Reel Generation System](./reel-generation-system.md)
- **Working on the manual editor?** See [Manual Editor System](./manual-editor-system.md)
- **Adding admin capabilities?** See [Admin Dashboard](./admin-dashboard.md)
- **User uploads vs content-linked files?** See [User-Uploaded Media](./user-uploaded-media-system.md) vs [Content-Scoped Assets](./content-assets-system.md)
- **Contact form or public upload?** See [Shared & Public API](./shared-public-api.md)

---

*Last updated: March 2026*
