# Reel Generation System Technical Specifications

## Overview

The ContentAI reel generation system operates as a sophisticated two-phase pipeline: **Generation** and **Assembly**. This document details the technical architecture, API endpoints, and implementation specifics.

## Prerequisites

Before reel generation can take place, several prerequisites must be satisfied:

### User Authentication & Authorization
```typescript
// Required JWT claims
interface FirebaseUser {
  uid: string;
  email: string;
  stripeRole: "free" | "basic" | "pro" | "enterprise"; // Subscription tier
  email_verified: boolean;
}
```

### Database Prerequisites
1. **Generated Content Record**: Must exist in `generated_content` table
   ```sql
   SELECT id, generated_hook, generated_script, clean_script_for_audio 
   FROM generated_content 
   WHERE id = ? AND user_id = ? AND status = 'draft'
   ```

2. **Reel Analysis** (optional but recommended): Source reel analysis for better generation
   ```sql
   SELECT hook_pattern, emotional_trigger, format_pattern 
   FROM reel_analyses 
   WHERE reel_id = ?
   ```

### Usage Limits & Tier Validation
```typescript
const GENERATION_LIMITS = {
  free: { daily: 1, analyses: 2 },
  basic: { daily: 10, analyses: 10 },
  pro: { daily: 50, analyses: Infinity },
  enterprise: { daily: Infinity, analyses: Infinity }
};

// Check daily usage
const todayUsage = await getDailyUsage(userId, "reel_generation");
if (todayUsage >= limits.daily) {
  throw new Error("Daily generation limit exceeded");
}
```

### Service Availability Checks
```typescript
// AI Service Availability (through AI client abstraction)
function checkAIServiceAvailability(): boolean {
  const enabledProviders = getEnabledProviders();
  return enabledProviders.length > 0;
}

// Video Provider Availability
function checkVideoProviderAvailability(): boolean {
  return !!(FAL_API_KEY || RUNWAY_API_KEY);
}

// Storage Availability
function checkStorageAvailability(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}
```

### Runtime Binary Requirements
- `ffmpeg` must be available in the backend runtime `PATH` for assembly jobs.
- Assembly performs a preflight check and fails fast with an actionable error when `ffmpeg` is missing.

### Required Environment Variables
```env
# AI Services (through AI client abstraction)
# At least one AI provider must be configured:
OPENAI_API_KEY=optional               # OpenAI models
OPEN_ROUTER_KEY=optional              # OpenRouter models  
ANTHROPIC_API_KEY=optional            # Claude models

# AI Model Configuration
OPENAI_MODEL=gpt-4o-mini              # OpenAI model to use
OPEN_ROUTER_MODEL=anthropic/claude-3.5-haiku # OpenRouter model
ANALYSIS_MODEL=claude-haiku-4-5-20251001    # Analysis model
GENERATION_MODEL=claude-sonnet-4-6            # Generation model

# Video Generation Services (at least one required)
FAL_API_KEY=optional                 # Kling video generation
RUNWAY_API_KEY=optional              # Runway video generation

# Storage
R2_ACCOUNT_ID=required               # Cloudflare R2
R2_ACCESS_KEY_ID=required           # R2 access key
R2_SECRET_ACCESS_KEY=required        # R2 secret key
R2_PUBLIC_URL=optional               # Public CDN URL

# Database
DATABASE_URL=required                # PostgreSQL connection

# Configuration
VIDEO_GENERATION_PROVIDER=kling-fal  # Default video provider
NODE_ENV=production                  # Environment
```

### Frontend Prerequisites
```typescript
// Required React Query data
const generatedContent = useQuery({
  queryKey: queryKeys.api.generatedContent(contentId),
  enabled: !!contentId && isAuthenticated
});

// Required user context
const { user } = useAuth();
const hasValidSubscription = user?.stripeRole !== 'free' || hasRemainingGenerations;

// Required feature flags
const { videoGenerationEnabled } = useFeatureFlags();
```

### Content Requirements
1. **Valid Generated Content**: Must have at least one of:
   - `generated_hook` (for single-shot videos)
   - `generated_script` (for multi-shot videos)
   - `clean_script_for_audio` (for voiceover generation)

2. **Content Validation**:
   ```typescript
   function validateContentForGeneration(content: GeneratedContent): boolean {
     return !!(content.generatedHook?.trim() || 
              content.generatedScript?.trim() || 
              content.cleanScriptForAudio?.trim());
   }
   ```

### Rate Limiting
```typescript
// Applied per user tier
const rateLimits = {
  free: { requests: 5, window: '1h' },
  basic: { requests: 20, window: '1h' },
  pro: { requests: 100, window: '1h' },
  enterprise: { requests: 500, window: '1h' }
};
```

## System Architecture

```
Frontend (React Hooks)
├── useGenerateReel() → POST /api/video/reel
└── useAssembleReel() → POST /api/video/assemble

        ↓ HTTPS API calls

Backend (Hono Routes)
├── POST /api/video/reel → runReelGeneration()
├── POST /api/video/assemble → runAssembleFromExistingClips()
└── GET /api/video/jobs/:jobId → job status

        ↓

Services
├── content-generator.ts → Claude AI for text generation
├── video-generation/ → Kling/Runway providers
└── video/job.service.ts → Async job management

        ↓

Storage & Database
├── PostgreSQL (Drizzle) → jobs, assets, metadata
└── Cloudflare R2 → video files, audio assets
```

## Phase 1: Generation

### Content Analysis & Generation

**AI Models (through AI client abstraction):**
- **Provider Priority**: OpenAI → Claude/Anthropic → OpenRouter (with automatic fallback)
- **Analysis Tier**: Uses configured analysis model (default: Claude Haiku)
- **Generation Tier**: Uses configured generation model (default: Claude Sonnet)

**AI Client Usage:**
```typescript
// All AI calls go through the unified client
const { text: rawText, model } = await callAi({
  system: loadPrompt("reel-analysis"),
  userContent: analysisPrompt,
  maxTokens: 512,
  modelTier: "analysis",        // Uses cheaper/fast model
  featureType: "reel_analysis",
  userId,
  metadata: { reelId }
});

// Provider fallback is automatic based on enabled providers
// Priority: OpenAI → Claude → OpenRouter
```

**Analysis Extraction:**
```typescript
interface ReelAnalysis {
  hookPattern: string;        // "Bold claim opener"
  hookCategory: string;       // "Curiosity | Controversy | How-to | Storytime"
  emotionalTrigger: string;   // "Fear of missing out | Inspiration | Shock"
  formatPattern: string;      // "Talking head | B-roll | Text overlay | Tutorial"
  ctaType: string;           // "Follow | Comment | Save | Share"
  captionFramework: string;   // "Hook → Value → CTA"
  curiosityGapStyle: string;  // "Incomplete information reveal"
  remixSuggestion: string;   // Concrete remix suggestion
}
```

### Video Clip Generation

**Technical Flow:**

1. **Script Parsing**: `parseScriptShots()` extracts individual shot descriptions
   ```typescript
   const shotsFromScript = parseScriptShots(content.generatedScript);
   // Returns: [{ shotIndex: 0, description: "...", durationSeconds: 5 }]
   ```

2. **Provider Selection**: Multi-provider fallback system
   ```typescript
   const PROVIDERS = {
     "kling-fal": klingFalProvider,      // Primary
     "image-ken-burns": imageKenBurnsProvider, // Fallback
     "runway": runwayProvider,           // Tertiary
   };
   ```

3. **Clip Generation**: Each shot becomes a separate video clip
   ```typescript
   const clip = await generateVideoClip({
     prompt: shot.description,
     durationSeconds: shot.durationSeconds,
     aspectRatio: "9:16" | "16:9" | "1:1",
     providerOverride: "kling-fal",
     metadata: { shotIndex, generatedContentId }
   });
   ```

4. **Asset Storage**: Clips stored with comprehensive metadata
   ```typescript
   await db.insert(reelAssets).values({
     type: "video_clip",
     r2Key: clip.r2Key,
     durationMs: clip.durationSeconds * 1000,
     metadata: {
       shotIndex,
       sourceType: "ai_generated",
       provider: clip.provider,
       generationPrompt: shot.description,
       useClipAudio: false
     }
   });
   ```

**API Endpoint**: `POST /api/video/reel`
```json
{
  "generatedContentId": 123,
  "prompt": "Custom prompt override",
  "durationSeconds": 5,
  "aspectRatio": "9:16",
  "provider": "kling-fal"
}
```

**Response**: 
```json
{
  "jobId": "uuid-string",
  "status": "queued",
  "generatedContentId": 123
}
```

## Phase 2: Assembly

### Video Assembly Pipeline

**Technical Process:**

#### 1. Clip Retrieval & Preparation
```typescript
const shotAssets = await loadShotAssets(userId, generatedContentId);
// Sorted by shotIndex ascending
```

#### 2. FFmpeg Concatenation
```typescript
async function ffmpegConcatClips({
  signedClipUrls: string[],
  outputPath: string,
  workDir: string,
  useClipAudioByIndex?: boolean[]
}): Promise<void>
```

**Process:**
- Downloads clips via signed R2 URLs
- Mutes audio unless `useClipAudio` is true
- Creates concat.txt file: `file 'clip-0-muted.mp4'`
- Uses FFmpeg concat demuxer for lossless joining
- Fallback re-encoding if direct concat fails

#### 3. Audio Mixing System
```typescript
async function mixAssemblyAudio({
  inputVideoPath: string,
  outputPath: string,
  voiceoverPath?: string,
  musicPath?: string,
  keepClipAudio: boolean
}): Promise<boolean>
```

**Audio Levels & Mixing:**
- **Voiceover**: Volume 1.0x (primary)
- **Music**: Volume 0.22x (background)
- **Original Clip Audio**: Volume 0.35-0.45x (supplemental)
- **Mixing Formula**: `amix=inputs=3:duration=longest:dropout_transition=2`

**Mixing Logic:**
```bash
# Voiceover + Music + Clip Audio
[0:a]volume=0.35[clip];[1:a]volume=1.0[vo];[2:a]volume=0.22[music];
[clip][vo][music]amix=inputs=3:duration=longest:dropout_transition=2[mix]
```

#### 4. Caption Rendering
```typescript
async function createAssCaptions({
  scriptText: string,
  totalDurationMs: number,
  outputPath: string
}): Promise<boolean>
```

**Caption Specifications:**
- **Chunk Size**: 3 words per subtitle
- **Font**: Arial, 48-56px (dynamic sizing)
- **Format**: ASS (Advanced SubStation Alpha)
- **Position**: Center-aligned, bottom margin
- **Duration**: Calculated based on total video length

**ASS Format:**
```
Dialogue: 0,00:00:00.00,00:02:50.00,Default,,0,0,0,,{\fs48}FIRST THREE WORDS
```

#### 5. Final Output & Storage
```typescript
const outputBuffer = Buffer.from(await Bun.file(workingVideoPath).arrayBuffer());
const assembledR2Key = `assembled/${userId}/${generatedContentId}/${jobId}.mp4`;
const assembledR2Url = await uploadFile(outputBuffer, assembledR2Key, "video/mp4");
```

**API Endpoint**: `POST /api/video/assemble`
```json
{
  "generatedContentId": 123,
  "includeCaptions": true,
  "audioMix": {
    "includeClipAudio": true,
    "voiceoverVolume": 1.0,
    "musicVolume": 0.22,
    "clipAudioVolume": 0.35
  }
}
```

### How Caption Rendering Works
- Captions are rendered as an ASS subtitle file, then burned into the video using FFmpeg `-vf ass=...`.
- Captions are composited on top of the picture and become part of the final exported video frames.

## Job Queue System

### Job Types & States
```typescript
type VideoJobKind = "reel_generate" | "shot_regenerate" | "assemble";
type JobStatus = "queued" | "running" | "completed" | "failed";
```

### Job Lifecycle
1. **Creation**: Job created with request metadata
2. **Queueing**: Added to async queue via `setTimeout()`
3. **Execution**: Background processing with status updates
4. **Completion**: Results stored, status updated
5. **Cleanup**: Temporary files removed

### Retry Mechanism
```typescript
// POST /api/video/jobs/:jobId/retry
const retryJob = await videoJobService.createJob({
  userId: job.userId,
  generatedContentId: job.generatedContentId,
  kind: job.kind,
  request: job.request  // Same parameters
});
```

## Asset Management

### Database Schema
```sql
CREATE TABLE reel_assets (
  id SERIAL PRIMARY KEY,
  generated_content_id INTEGER,
  user_id TEXT,
  type TEXT, -- "video_clip" | "voiceover" | "music" | "assembled_video"
  r2_key TEXT,
  r2_url TEXT,
  duration_ms INTEGER,
  metadata JSONB, -- shotIndex, provider, audio settings
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Asset Types & Metadata
```typescript
// Video Clip Asset
{
  type: "video_clip",
  metadata: {
    shotIndex: 0,
    sourceType: "ai_generated",
    provider: "kling-fal",
    generationPrompt: "Person walking on beach",
    hasEmbeddedAudio: false,
    useClipAudio: false
  }
}

// Assembled Video Asset
{
  type: "assembled_video",
  metadata: {
    sourceType: "phase4_ffmpeg_concat+audio_mix+captions",
    clipCount: 3,
    hasVoiceover: true,
    hasMusic: true,
    appliedAudioMix: true,
    captionsApplied: true
  }
}
```

## Error Handling & Fallbacks

### Provider Fallback Logic
```typescript
function getVideoGenerationProvider(override?: VideoProvider) {
  const name = override ?? VIDEO_GENERATION_PROVIDER;
  if (!PROVIDERS[name].isAvailable()) {
    // Graceful fallback order
    const fallbackOrder = ["kling-fal", "image-ken-burns", "runway"];
    for (const fallback of fallbackOrder) {
      if (PROVIDERS[fallback].isAvailable()) {
        return PROVIDERS[fallback];
      }
    }
  }
}
```

### Graceful Degradation
- **Audio Mix Failure**: Continues without audio mixing
- **Caption Burn Failure**: Continues without captions
- **FFmpeg Concat Failure**: Falls back to re-encoding
- **Provider Unavailable**: Automatic provider switching

### FFmpeg Fallback Strategies
```typescript
// Primary: Direct concat
ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4

// Fallback: Re-encode
ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -preset fast output.mp4
```

## Performance Optimizations

### Concurrency & Streaming
- **Parallel Downloads**: Multiple clips downloaded simultaneously
- **Streaming Processing**: Large files processed as streams
- **Temporary File Management**: Efficient `/tmp` directory usage
- **Non-blocking Operations**: Cost tracking runs async

### Cost Tracking
```typescript
async function recordMediaCost({
  userId,
  provider,
  featureType: "video_gen",
  costUsd,
  durationMs,
  metadata
}) {
  await db.insert(aiCostLedger).values({
    provider,
    totalCost: costUsd.toFixed(8),
    durationMs,
    metadata: { prompt: prompt.slice(0, 200) }
  });
}
```

## Frontend Integration

### Re-assembly UX
- The Video workspace exposes a dedicated **Re-assemble** action in the generation controls.
- Re-assembly still uses `POST /api/video/assemble` against existing shot/audio assets, so users can rebuild final output without regenerating clips.
- Users can tune assembly mix controls per run:
  - `includeClipAudio` (on/off)
  - `voiceoverVolume` (`0.00`–`2.00`)
  - `musicVolume` (`0.00`–`1.00`)
  - `clipAudioVolume` (`0.00`–`1.00`)

### React Hooks
```typescript
// Generation Hook
export function useGenerateReel() {
  return useMutation({
    mutationFn: (data: CreateReelRequest) =>
      authenticatedFetchJson<CreateReelResponse>("/api/video/reel", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      // Invalidate related queries
      queryClient.invalidateQueries(queryKeys.api.videoJob(res.jobId));
    },
  });
}

// Assembly Hook
export function useAssembleReel() {
  return useMutation({
    mutationFn: ({ generatedContentId, includeCaptions = true }) =>
      authenticatedFetchJson<CreateReelResponse>("/api/video/assemble", {
        method: "POST",
        body: JSON.stringify({ generatedContentId, includeCaptions }),
      }),
  });
}
```

### Query Management
```typescript
queryKeys: {
  api: {
    videoJob: (jobId: string) => ['videoJob', jobId],
    contentAssets: (contentId: number) => ['contentAssets', contentId],
    generatedContent: (contentId: number) => ['generatedContent', contentId]
  }
}
```

## Security & Access Control

### Authentication & Authorization
```typescript
// Middleware Chain
app.post("/reel",
  rateLimiter("customer"),      // Rate limiting
  csrfMiddleware(),             // CSRF protection
  authMiddleware("user"),       // JWT auth
  zValidator("json", schema),   // Input validation
  handler
);
```

### User Ownership Validation
```typescript
const content = await fetchOwnedContent(userId, generatedContentId);
if (!content) {
  return c.json({ error: "Content not found" }, 404);
}
```

## Monitoring & Observability

### Debug Logging
```typescript
debugLog.error("Video reel job failed", {
  service: "video-route",
  operation: "runReelGeneration",
  jobId: job.id,
  generatedContentId: job.generatedContentId,
  error: errorMessage,
});
```

### Job Status Tracking
- **Real-time Updates**: Job status changes logged
- **Performance Metrics**: Generation time, cost tracking
- **Error Analysis**: Failed job reasons and patterns

## Configuration

### Environment Variables
```env
# Video Generation
VIDEO_GENERATION_PROVIDER=kling-fal
FAL_API_KEY=your-fal-key
RUNWAY_API_KEY=your-runway-key

# Storage
R2_PUBLIC_URL=https://pub-cdn.example.com
R2_ACCOUNT_ID=your-account
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret

# AI Models
ANALYSIS_MODEL=claude-haiku-4-5-20251001
GENERATION_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=your-anthropic-key
```

## Future Enhancements

### Planned Improvements
1. **Real-time WebSocket Updates**: Job status via WebSocket
2. **Advanced Audio Processing**: Noise reduction, audio normalization
3. **Custom Caption Styles**: User-configurable caption appearance
4. **Batch Processing**: Multiple reels in single job
5. **Quality Metrics**: Automatic video quality assessment

### Scalability Considerations
- **Horizontal Scaling**: Job queue can be distributed across workers
- **CDN Integration**: Edge caching for assembled videos
- **Database Optimization**: Indexing for asset queries
- **Storage Optimization**: Lifecycle policies for temporary assets

---

*Last updated: March 2026*
*System Version: ContentAI v1.0*
