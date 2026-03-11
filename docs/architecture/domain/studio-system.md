# Studio System Architecture

## Overview

The ReelStudio workspace is a specialized application within the SaaS template that provides AI-powered content intelligence for creators and marketers. It consists of four main pillars: Discovery, Analysis, Generation, and Queue management.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Studio Frontend (React)                 │
│  ┌─────────────┬──────────────────┬──────────────────┐ │
│  │   Reels     │   Phone Preview  │   Analysis Panel │ │
│  │   Sidebar   │   + Toolbar      │   + Generation   │ │
│  └─────────────┴──────────────────┴──────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS + Firebase Auth
┌─────────────────────▼───────────────────────────────────┐
│              Backend API (Hono / Bun)                  │
│  ┌─────────────┬──────────────────┬──────────────────┐ │
│  │   /api/reels│  /api/generation │    /api/queue    │ │
│  │   Discovery │   AI Generation  │  Scheduling      │ │
│  └─────────────┴──────────────────┴──────────────────┘ │
└─────────┬───────────────┬───────────────┬───────────────┘
          │               │               │
    ┌─────▼────┐   ┌──────▼──────┐  ┌───▼────┐
    │PostgreSQL│   │   Claude    │  │ Redis  │
    │ Reel Data│   │   AI API    │  │Rate Lmt│
    └──────────┘   └─────────────┘  └────────┘
```

---

## Core Components

### 1. Reel Discovery System

**Purpose**: Surface top-performing Instagram reels in any niche

**Frontend Components**:
- `ReelList.tsx` - Sidebar with reel thumbnails and metrics
- `PhonePreview.tsx` - Phone mockup with floating stat cards
- `StudioTopBar.tsx` - Navigation and niche search

**Backend APIs**:
```typescript
GET /api/reels?niche=fitness&limit=20     // List reels by niche
GET /api/reels/:id                         // Get reel + analysis
POST /api/reels/scan                       // Trigger niche scan
```

**Data Flow**:
1. User searches niche → `GET /api/reels?niche=fitness`
2. Backend queries `reels` table filtered by niche
3. Returns list with metrics: views, engagement rate, thumbnail emoji
4. First reel auto-selected → fetch full detail + analysis

---

### 2. AI Analysis System

**Purpose**: Break down why reels go viral using AI

**Frontend Components**:
- `AnalysisPanel.tsx` - Tabs for Analysis/Generate/History
- Analysis tags display (Warning, Curiosity, ListFormat, etc.)

**Backend APIs**:
```typescript
POST /api/reels/:id/analyze               // Run AI analysis
```

**AI Integration**:
- Uses Claude Haiku for fast, cost-effective analysis
- Prompt template: `reel-analysis.txt`
- Returns structured JSON: hookPattern, emotionalTrigger, formatPattern, etc.

**Analysis Schema**:
```typescript
interface ReelAnalysis {
  hookPattern: string;
  hookCategory: string;
  emotionalTrigger: string;
  formatPattern: string;
  ctaType: string;
  captionFramework: string;
  curiosityGapStyle: string;
  remixSuggestion: string;
}
```

---

### 3. Content Generation System

**Purpose**: AI-powered remix content generation

**Frontend Components**:
- Generation workspace in `AnalysisPanel.tsx`
- Full-screen generation page `/studio/generate`

**Backend APIs**:
```typescript
POST /api/generation                     // Generate content
GET /api/generation                      // Generation history
GET /api/generation/:id                  // Get single item
```

**Generation Flow**:
1. User selects reel + types prompt
2. Backend checks rate limits (per subscription tier)
3. Calls Claude Sonnet with `remix-generation.txt` prompt
4. Returns: hook, caption, scriptNotes
5. User can copy or add to queue

**Feature Gating**:
- Free: 1 generation/day
- Basic: 10 generations/day  
- Pro: 50 generations/day
- Enterprise: Unlimited

---

### 4. Content Queue System

**Purpose**: Schedule and manage generated content

**Frontend Components**:
- `QueuePage.tsx` - Main queue management interface
- Status filters and scheduling UI

**Backend APIs**:
```typescript
GET /api/queue                           // List queue items
PATCH /api/queue/:id                     // Update item (status, date)
DELETE /api/queue/:id                    // Remove from queue
```

**Queue States**:
- `draft` - Generated but not queued
- `queued` - Scheduled for posting
- `posted` - Successfully published
- `failed` - Publishing failed

**Pro+ Features**:
- Instagram API integration for direct publishing
- Advanced scheduling with timezone support
- Bulk operations

---

## Studio Routes Architecture

### Route Structure

```
/studio
├── /studio              → redirects to /studio/discover
├── /studio/discover     → Main 3-panel workspace
├── /studio/generate     → Full-screen generation
└── /studio/queue        → Content queue management
```

### Authentication Model

- **AuthGuard**: `authType="user"` on all studio routes
- **Redirect behavior**: Unauthenticated → `/sign-in`
- **Studio bypass**: Does not use `PageLayout` - has own dark theme shell

### Navigation Pattern

```
StudioTopBar (internal navigation)
├── Discover (default)
├── ✦ Generate  
└── Queue
```

---

## Database Schema

### Core Tables

```sql
-- Reel data from Instagram scraping/API
CREATE TABLE reels (
  id UUID PRIMARY KEY,
  username VARCHAR(255),
  niche VARCHAR(100),
  contentUrl TEXT,
  thumbnailEmoji VARCHAR(10),
  hook TEXT,
  caption TEXT,
  audioTrack TEXT,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  engagementRate DECIMAL(5,4),
  postedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- AI analysis results
CREATE TABLE reel_analyses (
  id UUID PRIMARY KEY,
  reelId UUID REFERENCES reels(id),
  hookPattern VARCHAR(100),
  hookCategory VARCHAR(50),
  emotionalTrigger VARCHAR(50),
  formatPattern VARCHAR(50),
  ctaType VARCHAR(50),
  captionFramework VARCHAR(50),
  curiosityGapStyle VARCHAR(50),
  remixSuggestion TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Generated content
CREATE TABLE generated_content (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES users(id),
  sourceReelId UUID REFERENCES reels(id),
  prompt TEXT,
  outputType VARCHAR(20), -- 'full' | 'hook' | 'caption'
  generatedHook TEXT,
  generatedCaption TEXT,
  generatedScript TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Content scheduling queue
CREATE TABLE queue_items (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES users(id),
  contentId UUID REFERENCES generated_content(id),
  status VARCHAR(20) DEFAULT 'queued',
  scheduledFor TIMESTAMP,
  postedAt TIMESTAMP,
  instagramPostId VARCHAR(100),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

---

## Performance Considerations

### Frontend Optimization

- **React Query**: Caches reel lists, analysis results, generation history
- **Virtual scrolling**: For large reel lists (future enhancement)
- **Image optimization**: Thumbnail emojis as lightweight visual indicators
- **Lazy loading**: Analysis details only when reel selected

### Backend Optimization

- **Database indexes**: `niche`, `engagementRate`, `postedAt` on reels table
- **Redis caching**: Rate limits, session data, frequently accessed analyses
- **AI cost management**: Haiku for analysis (cheaper), Sonnet for generation (higher quality)
- **Batch processing**: Future enhancement for bulk reel scanning

### Rate Limiting Strategy

```typescript
// Per-tier limits enforced server-side
const GENERATION_LIMITS = {
  free: { daily: 1, hourly: 1 },
  basic: { daily: 10, hourly: 5 },
  pro: { daily: 50, hourly: 20 },
  enterprise: { daily: Infinity, hourly: 100 }
};

const ANALYSIS_LIMITS = {
  free: { daily: 2, hourly: 2 },
  basic: { daily: 10, hourly: 5 },
  pro: { daily: Infinity, hourly: 50 },
  enterprise: { daily: Infinity, hourly: 100 }
};
```

---

## Security Model

### API Protection

- **Authentication**: Firebase JWT verification on all studio endpoints
- **Authorization**: User-scoped data queries (`userId = currentUserId`)
- **Rate limiting**: Redis-backed per user and per IP
- **Input validation**: Zod schemas on all API inputs

### AI Security

- **Content filtering**: Claude prompts include safety guidelines
- **PII prevention**: Analysis prompts explicitly exclude personal data extraction
- **Cost protection**: Tier limits prevent AI cost overruns
- **Graceful degradation**: 503 response if `ANTHROPIC_API_KEY` missing

### Data Privacy

- **User isolation**: All data scoped to `userId`
- **Right to deletion**: User account deletion cascades to all generated content
- **Analytics opt-out**: Usage tracking respects user preferences

---

## Error Handling

### Frontend Error Patterns

```typescript
// Network errors with retry
const { data, error, isLoading } = useReels(niche, {
  retry: 3,
  retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
});

// Rate limit handling
if (error?.status === 429) {
  showUpgradePrompt('generation');
}

// Graceful AI degradation
if (analysisError) {
  showWarning('AI analysis temporarily unavailable');
}
```

### Backend Error Patterns

```typescript
// Feature gate enforcement
if (userTier === 'free' && dailyGenerations >= 1) {
  return c.json({ 
    error: 'GENERATION_LIMIT_EXCEEDED',
    tier: userTier,
    limit: 1
  }, 429);
}

// AI service unavailability
if (!ANTHROPIC_API_KEY) {
  return c.json({ 
    error: 'AI_SERVICE_UNAVAILABLE',
    message: 'AI analysis temporarily disabled'
  }, 503);
}
```

---

## Migration Notes

### From Generator Template

**Removed Components**:
- `features/generator/` - Entire generator system
- Generator-specific routing and UI
- Financial generation logic

**Added Components**:
- `features/reels/` - Reel discovery and analysis
- `features/generation/` - AI content generation  
- `features/studio/` - Main workspace UI
- Studio-specific routing and dark theme

**Preserved Infrastructure**:
- Auth system (Firebase)
- Subscription system (Stripe)
- Admin dashboard
- User management
- Rate limiting and security

### Data Migration

- Users and subscriptions preserved
- Generator usage data archived
- New reels/analysis/generation tables added
- Feature usage tracking adapted for studio metrics

---

## Related Documentation

- [Generation System](./generation-system.md) - AI content generation details
- [API Architecture](../core/api.md) - General API patterns and security
- [Database Schema](../core/database.md) - Database patterns and validation
- [Authentication](../core/authentication.md) - Auth and authorization patterns

---

*Last Updated: March 2026*
