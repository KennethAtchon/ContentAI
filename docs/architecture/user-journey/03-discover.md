# Discover Journey

**Route:** `/studio/discover`
**Auth:** Required (`authType="user"`)
**Default landing** for returning authenticated users.

---

## Overview

The Discover page is a three-column layout:
- **Left sidebar:** Niche selector + reel list + Trending Audio panel (resizable with draggable divider)
- **Center:** TikTok-style vertical video feed
- **Right:** AI Analysis panel

---

## What the User Sees

**Left sidebar:**
- Dropdown to select a content niche (e.g., "Fitness", "Finance", "Food")
- "Trending" option showing top reels from the last 7 days across all niches
- Scrollable list of reel thumbnails/titles for the selected niche
- Trending Audio panel below (draggable resizer separates the two)

**Center feed:**
- Vertically scrollable TikTok-style video cards
- Each card shows: video preview, engagement stats (views, likes, comments), hook text preview
- "Analyze" button on each card
- Infinite scroll — loads more as user scrolls to bottom

**Right panel:**
- Empty state until a reel is selected: "Select a reel to view analysis"
- When a reel is selected: engagement metrics, hook text, caption preview, audio track info
- "Generate Analysis" button (if no AI analysis yet)
- "Generate Content" button (navigates to `/studio/generate` with reel pre-attached)

---

## Journey: Browse and Discover Reels

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Navigate to /studio/discover
    FE->>BE: GET /api/reels/niches
    BE->>DB: SELECT * FROM niches WHERE active=true
    DB-->>BE: Niches list
    BE-->>FE: [{ id, name }, ...]
    FE->>FE: Auto-select first niche

    FE->>BE: GET /api/reels?nicheId=1&sort=fresh&limit=20
    BE->>DB: SELECT reels WHERE niche_id=1 ORDER BY scraped_at DESC LIMIT 20
    DB-->>BE: Reels page 1
    BE-->>FE: [{ id, hookText, views, likes, ... }]
    FE->>FE: Render TikTokFeed with reel cards

    U->>FE: Scroll to bottom of feed
    FE->>BE: GET /api/reels?nicheId=1&sort=fresh&limit=20&offset=20
    BE-->>FE: Reels page 2
    FE->>FE: Append to feed (infinite scroll)
```

---

## Journey: Switch Niches

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Select "Trending" from niche dropdown
    FE->>BE: GET /api/reels?sort=viral&days=7&limit=20
    BE-->>FE: Top reels from last 7 days (all niches)
    FE->>FE: Re-render feed with trending reels

    U->>FE: Select "Fitness" niche
    FE->>BE: GET /api/reels?nicheId=3&sort=fresh&limit=20
    BE-->>FE: Fitness reels
    FE->>FE: Re-render feed
```

---

## Journey: View Reel Analysis

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Click a reel card (or click "Analyze" button)
    FE->>FE: Set activeReelId = reel.id
    FE->>BE: GET /api/reels/:id
    BE->>DB: SELECT reel + reel_analyses WHERE reel_id=:id
    DB-->>BE: Reel detail with analysis (or null)
    BE-->>FE: { reel, analysis: null }

    FE->>FE: Render AnalysisPanel
    Note over FE: Shows: views, likes, comments, engagement rate,
    Note over FE: hook text, caption preview, audio info

    alt No analysis exists
        FE->>FE: Show "Generate Analysis" button
    else Analysis exists
        FE->>FE: Show hook pattern, emotional trigger, format breakdown
    end
```

---

## Journey: Generate AI Analysis for a Reel

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant AI as Claude (Haiku)
    participant DB as PostgreSQL

    U->>FE: Click "Generate Analysis" in right panel
    FE->>BE: POST /api/reels/:id/analyze
    BE->>BE: usageGate("reel_analysis") — check plan limit
    alt Limit not exceeded
        BE->>AI: Analyze reel (hook pattern, emotional trigger, format)
        AI-->>BE: Analysis result
        BE->>DB: INSERT INTO reel_analyses { reel_id, hook_pattern, trigger, ... }
        BE->>DB: recordUsage(userId, "reel_analysis")
        BE-->>FE: { analysis }
        FE->>FE: Update AnalysisPanel with results
    else Limit exceeded
        BE-->>FE: 429 { limitReached: true }
        FE->>FE: Show LimitHitModal
    end
```

---

## Journey: Generate Content from a Reel

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend

    U->>FE: Click "Generate Content" in AnalysisPanel
    FE->>FE: Encode reel reference in URL params
    FE->>FE: Navigate to /studio/generate?reelRef=<reelId>
    Note over FE: /studio/generate opens with reel pre-attached as context
```

---

## Trending Audio Panel

Located at the bottom of the left sidebar, separated by a draggable resizer.

- Shows top trending audio tracks scraped from the niche
- Each track shows: track name, artist, usage count, preview play button
- Clicking a track filters the reel feed to show reels using that audio

---

## Key Components

| Component | Location | Purpose |
|---|---|---|
| `TikTokFeed` | `features/reels/components/` | Vertical scrollable reel feed |
| `AnalysisPanel` | `features/reels/components/AnalysisPanel.tsx` | Right-side analysis display |
| `GenerateFromReelButton` | `features/reels/components/` | "Generate Content" CTA |
| `NicheSelector` | `features/reels/components/` | Left sidebar niche dropdown |
