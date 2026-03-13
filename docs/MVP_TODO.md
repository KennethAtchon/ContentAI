# MVP TODO

Minimum viable product scope distilled from the research documents in `docs/research/`. Each item links back to its source doc for full context.

---

## 1. Generate Tab — AI Chat Interface
> Source: `research/generate-tab-ai-chat-interface.md`

### Database
- [x] Create `projects` table (id, userId, name, description, nicheId, createdAt, updatedAt)
- [x] Create `userNiches` table (id, userId, nicheId, isPrimary, createdAt) with unique constraint
- [x] Create `chatSessions` table (id, userId, projectId, title, createdAt, updatedAt)
- [x] Create `chatMessages` table (id, sessionId, role, content, reelRefs jsonb, generatedContentId, createdAt)
- [x] Add indexes (projects_user_id, user_niches_user_id, chat_sessions_user_id, chat_sessions_project_id, chat_messages_session_id)
- [x] Add Drizzle relations for all 4 tables
- [x] Run `bun db:generate && bun db:migrate`

### Backend
- [x] Create `POST/GET /api/projects` — create + list user projects
- [x] Create `GET/PUT/DELETE /api/projects/:id` — single project CRUD
- [x] Create `GET/POST /api/chat/sessions` — list + create chat sessions (filter by projectId)
- [x] Create `GET/DELETE /api/chat/sessions/:id` — get session with messages + delete
- [x] Create `POST /api/chat/sessions/:id/messages` — send message + stream AI response (SSE)
- [x] Create `chat-generate.txt` prompt file for conversational content generation
- [x] Create `chat-generator.ts` service — builds context from project niche + referenced reels, calls `streamText()`
- [x] Auto-title sessions from first message (first 50 chars)
- [x] Mount new routes in `index.ts`
- [x] Install `ai` package in backend if not present (for `streamText` + `toDataStreamResponse`)

### Frontend
- [x] Create `src/features/chat/` feature folder (components/, hooks/, services/, types/)
- [x] Create `chat.types.ts` — Project, ChatSession, ChatMessage types
- [x] Add query keys: projects, project, chatSessions, chatSession, chatMessages
- [x] Create `use-projects.ts` hook — project CRUD with React Query
- [x] Create `use-chat-sessions.ts` hook — session CRUD + message fetching
- [x] Create `use-chat-stream.ts` hook — `useChat` from `ai/react` with `authenticatedFetch`
- [x] Create `ProjectSidebar.tsx` — project list, new project button, session list
- [x] Create `ChatPanel.tsx` — scrollable message thread
- [x] Create `ChatMessage.tsx` — user/assistant message bubbles
- [x] Create `ChatInput.tsx` — message input with send button
- [x] Replace `studio/generate.tsx` with new two-panel layout (sidebar + chat)
- [x] Store `projectId` and `sessionId` in URL search params
- [x] Add i18n keys for all new UI strings
- [x] Install `ai` package in frontend (for `useChat`)

---

## 2. Generate Tab — Reel Creation Pipeline (Script Only)
> Source: `research/generate-reel-creation-pipeline.md`

### AI Analysis Enhancement
- [ ] Add new fields to `reelAnalyses` table: shotBreakdown (jsonb), engagementDrivers (jsonb), replicabilityScore (int), replicabilityNotes (text)
- [ ] Update `reel-analysis.txt` prompt to produce enhanced analysis output
- [ ] Run migration

### Script Generation
- [ ] Add `generatedMetadata` jsonb column to `generatedContent` (structured shot list, text overlays, hashtags)
- [ ] Ensure chat AI outputs structured format: hook, script/shot list, caption, hashtags, CTA

### Content Versioning
- [ ] Add `version` (integer, default 1) and `parentId` (self-ref FK) to `generatedContent`
- [ ] When user iterates in chat, create new version linked to parent
- [ ] Run migration

---

## 3. Queue Tab Redesign
> Source: `research/queue-tab-design.md`

### Backend
- [ ] Enhance `GET /api/queue` response to include generatedContent preview (hook, caption, thumbnailR2Key) and project info
- [ ] Add `projectId` and `sort` query params to `GET /api/queue`
- [ ] Add `status` field to `PATCH /api/queue/:id` with state transition validation (Draft→Ready→Scheduled→Posted)

### Frontend
- [ ] Redesign queue page with content cards showing thumbnail, hook text, project name, status badge
- [ ] Add status filter sidebar (All, Draft, Ready, Scheduled, Posted, Failed)
- [ ] Add "Edit" button → navigates to `/studio/generate?project={id}&session={id}`
- [ ] Add delete with confirmation dialog
- [ ] Add project filter dropdown

### Database
- [ ] Add `thumbnailR2Key` and `videoR2Url` columns to `generatedContent` (for assembled output, distinct from source reel)
- [ ] Verify `queueItems.status` values align with new flow (draft, ready, scheduled, posted, failed)

---

## 4. Usage Limits (Hard Blockers)
> Source: `research/usage-limits-and-cost-tracking.md`

### Backend
- [ ] Redefine subscription tiers in `subscription.constants.ts` for ContentAI (Free/Creator/Pro/Agency with generation, analysis, TTS, video limits)
- [ ] Create `usage-gate.ts` middleware — checks `featureUsages` count against tier limits per billing period
- [ ] Wire usage gate into all billable endpoints:
  - `POST /api/chat/sessions/:id/messages` (generation)
  - `POST /api/reels/:id/analyze` (analysis)
- [ ] Enhance `GET /api/customer/usage` to return actual limits from tier + reset date
- [ ] Update Stripe products/prices to match new tiers

### Frontend
- [ ] Add usage display in Generate tab sidebar (progress bars per feature)
- [ ] Show "Limit reached — upgrade" UI when a limit is hit (disable action + upgrade link)
- [ ] Handle 403 from usage gate gracefully with upgrade prompt

---

## 5. AI Cost Tracking (Admin)
> Source: `research/usage-limits-and-cost-tracking.md`

### Database
- [ ] Create `aiCostLedger` table (id, userId, provider, model, featureType, inputTokens, outputTokens, inputCost, outputCost, totalCost, durationMs, metadata jsonb, createdAt)
- [ ] Add indexes (created_at, user_id, feature_type)

### Backend
- [ ] Create `ai-pricing.constants.ts` with per-model token pricing
- [ ] Modify `aiClient.ts` to record cost after every `generateText`/`streamText` call
- [ ] Create `GET /api/admin/ai-costs` endpoint (period, groupBy, breakdown by provider/model/feature)
- [ ] Create `GET /api/admin/ai-costs/by-user` endpoint (top users by cost)

### Frontend (Admin)
- [ ] Add AI Cost Dashboard section to admin portal (total spend, breakdown table, daily trend)

---

## 6. Discover Improvements
> Source: `research/discover-improvements.md`

### Daily Background Scan
- [ ] Create `backend/src/jobs/daily-scan.ts` — Bun cron job at 3 AM, re-scrapes all active niches with 30s stagger
- [ ] Import and call `startDailyScan()` from `backend/src/index.ts`

### Fresh Sorting
- [ ] Add `sort=fresh` to `GET /api/reels` — sorts by `DATE(scrapedAt) DESC, views DESC`
- [ ] Make `fresh` the default sort for the discover page
- [ ] Update frontend discover page to use new default

### Trending Across Niches
- [ ] Add `niche=trending` handling to `GET /api/reels` — no niche filter, last 7 days, sorted by views
- [ ] Add "Trending — All Niches" option to niche dropdown in `discover.tsx`
- [ ] Add `studio_discover_trending` i18n key

### Trending Audio
- [ ] Create `trendingAudio` table (id, audioId unique, audioName, artistName, useCount, firstSeen, lastSeen)
- [ ] Populate during reel scraping in `scraping.service.ts` — upsert after `saveReels()`
- [ ] Create `GET /api/audio/trending` endpoint (days, nicheId, limit params)
- [ ] Add collapsible "Trending Audio" section in discover sidebar

---

## Implementation Order

The sections above are listed by priority. Recommended build sequence:

```
Week 1-2:  Database migrations (all new tables from sections 1-6)
Week 2-3:  Backend APIs — Projects + Chat routes (section 1)
Week 3:    Backend APIs — Usage gate + cost tracking (sections 4-5)
Week 3-4:  Frontend — Chat UI + replace generate page (section 1)
Week 4:    Frontend — Queue tab redesign (section 3)
Week 4-5:  Discover improvements (section 6)
Week 5:    Script generation enhancements (section 2)
Week 5:    Admin cost dashboard (section 5)
Week 5-6:  Testing, polish, tier pricing finalization
```

Total: ~6 weeks for full MVP.

---

## What's Deferred (Post-MVP)

These are explicitly **not** in the MVP:

- Reel referencing in chat (picker modal + `@` mention search)
- TTS voiceover integration
- AI video generation (text-to-video, image-to-video)
- Video upload + FFmpeg assembly
- In-browser editing suite
- User niche preferences CRUD
- Queue bulk operations
- Mobile responsive layout
- Session rename
- Budget alerts / projected spend
- Audio library integration (Epidemic Sound, etc.)
- Instagram publishing via Graph API
- Niche diversity in trending (window function)
- Content moderation
- Template library
- Collaboration / team features
