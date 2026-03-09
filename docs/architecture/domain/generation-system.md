# Generation System Architecture

## Overview

The AI Content Generation system transforms viral reel analysis into actionable content through AI-powered remixing. It uses Claude models to generate hooks, captions, and scripts that maintain the viral structure while adapting for new contexts.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Generation Frontend                     │
│  ┌─────────────┬──────────────────┬──────────────────┐ │
│  │   Reel       │   Prompt Input   │   Generated      │ │
│  │   Selector   │   + Controls     │   Output         │ │
│  └─────────────┴──────────────────┴──────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS + Auth + CSRF
┌─────────────────────▼───────────────────────────────────┐
│              Generation API (Hono)                     │
│  ┌─────────────┬──────────────────┬──────────────────┐ │
│  │   Rate Limit │   Claude AI      │   Content        │ │
│  │   Checking   │   Integration    │   Storage        │ │
│  └─────────────┴──────────────────┴──────────────────┘ │
└─────────┬───────────────┬───────────────┬───────────────┘
          │               │               │
    ┌─────▼────┐   ┌──────▼──────┐  ┌───▼────┐
    │PostgreSQL│   │   Claude    │  │ Redis  │
    │ Content  │   │   Sonnet     │  │Limits  │
    └──────────┘   └─────────────┘  └────────┘
```

---

## Generation Pipeline

### 1. Request Processing

```typescript
// POST /api/generation
interface GenerationRequest {
  sourceReelId: string;
  prompt: string;
  outputType: 'full' | 'hook' | 'caption';
}
```

**Validation Steps**:
1. Authenticate user via Firebase JWT
2. Validate request schema with Zod
3. Check rate limits based on user subscription tier
4. Verify source reel exists and user has access

### 2. Rate Limiting

**Tier-Based Limits**:
```typescript
const GENERATION_LIMITS = {
  free: { daily: 1, hourly: 1 },
  basic: { daily: 10, hourly: 5 },
  pro: { daily: 50, hourly: 20 },
  enterprise: { daily: Infinity, hourly: 100 }
};
```

**Redis Implementation**:
```typescript
const rateLimitKey = `gen_limit:${userId}:${date}`;
const currentCount = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 86400); // 24 hours

if (currentCount > GENERATION_LIMITS[userTier].daily) {
  throw new RateLimitError('GENERATION_LIMIT_EXCEEDED');
}
```

### 3. AI Integration

**Model Selection**:
- **Claude Sonnet** (claude-3-5-sonnet-20241022): High-quality generation
- **Cost**: ~$0.015 per 1K tokens (input + output)
- **Context Window**: 200K tokens (sufficient for reel + analysis)

**Prompt Engineering**:
```typescript
const generationPrompt = `
You are a content creation expert specializing in viral social media content.

SOURCE REEL ANALYSIS:
- Hook Pattern: ${reelAnalysis.hookPattern}
- Emotional Trigger: ${reelAnalysis.emotionalTrigger}
- Format: ${reelAnalysis.formatPattern}
- Original Hook: "${reel.hook}"
- Engagement Rate: ${reel.engagementRate}%

USER PROMPT: "${prompt}"

TASK: Generate ${outputType === 'full' ? 'hook + caption + script notes' : outputType} that maintains the viral structure while adapting to the user's request.

RESPONSE FORMAT (JSON):
{
  "hook": "Compelling hook that mirrors the viral pattern",
  "caption": "Engaging caption that extends the hook",
  "scriptNotes": "Key talking points and delivery instructions"
}
`;
```

### 4. Response Processing

```typescript
interface GenerationResponse {
  id: string;
  sourceReelId: string;
  prompt: string;
  outputType: string;
  generatedHook: string;
  generatedCaption: string;
  generatedScript: string;
  status: 'draft';
  createdAt: string;
}
```

**Database Storage**:
```sql
INSERT INTO generated_content (
  id, userId, sourceReelId, prompt, outputType,
  generatedHook, generatedCaption, generatedScript,
  status, createdAt
) VALUES (
  gen_id(), user_id, reel_id, prompt, output_type,
  hook, caption, script, 'draft', NOW()
);
```

---

## Frontend Architecture

### Components

#### 1. Generation Workspace (`/studio/generate`)

**Layout**:
- Left: Reel picker (same as discover sidebar)
- Center: Large prompt input + output type selector + generate button
- Right: Generation history (last 20 items)

**Key Features**:
- Output type toggle (Full/Hook/Caption)
- Prompt templates and suggestions
- Real-time generation status
- Copy to clipboard actions

#### 2. Generation Panel (in Discover)

**Integration**:
- Lives in `AnalysisPanel.tsx` under "Generate" tab
- Uses selected reel from main workspace
- Shows inline generation results
- Quick actions: Copy Hook, Copy Caption, Add to Queue

#### 3. Generation History

**Data Structure**:
```typescript
interface GenerationItem {
  id: string;
  sourceReel: {
    id: string;
    username: string;
    hook: string;
  };
  prompt: string;
  output: {
    hook: string;
    caption: string;
    script: string;
  };
  createdAt: string;
  status: 'draft' | 'queued' | 'posted';
}
```

**Features**:
- Search and filter by prompt or reel
- Regenerate from history
- Copy individual components
- Add to queue directly

### State Management

**React Query Keys**:
```typescript
export const queryKeys = {
  generation: {
    all: ['generation'] as const,
    history: (userId: string) => ['generation', 'history', userId] as const,
    item: (id: string) => ['generation', 'item', id] as const,
  }
};
```

**Mutations**:
```typescript
const generateMutation = useMutation({
  mutationFn: generateContent,
  onSuccess: (data) => {
    // Invalidate history
    queryClient.invalidateQueries({
      queryKey: queryKeys.generation.history(userId)
    });
    
    // Show success toast
    toast.success('Content generated successfully!');
  },
  onError: (error) => {
    if (error.status === 429) {
      // Show upgrade prompt
      setUpgradePrompt({ feature: 'generation', limit: error.limit });
    } else {
      toast.error('Generation failed. Please try again.');
    }
  }
});
```

---

## Backend Implementation

### API Endpoints

#### POST /api/generation

```typescript
app.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  
  // Validate request
  const { sourceReelId, prompt, outputType } = generationSchema.parse(body);
  
  // Check rate limits
  await checkGenerationLimit(user.id, user.tier);
  
  // Get source data
  const reel = await getReelWithAnalysis(sourceReelId);
  
  // Call Claude AI
  const result = await callClaudeAPI({
    model: 'claude-3-5-sonnet-20241022',
    prompt: buildGenerationPrompt(reel, prompt, outputType),
    maxTokens: 1000
  });
  
  // Parse response
  const generated = parseGenerationResponse(result);
  
  // Store in database
  const content = await db.generatedContent.create({
    data: {
      userId: user.id,
      sourceReelId,
      prompt,
      outputType,
      ...generated,
      status: 'draft'
    }
  });
  
  return c.json({ data: content }, 201);
});
```

#### GET /api/generation

```typescript
app.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { limit = 20, offset = 0 } = c.req.query();
  
  const items = await db.generatedContent.findMany({
    where: { userId: user.id },
    include: {
      sourceReel: {
        select: {
          id: true,
          username: true,
          hook: true,
          thumbnailEmoji: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
  
  return c.json({ data: items });
});
```

### Error Handling

#### Rate Limit Exceeded
```typescript
if (exceedsLimit) {
  return c.json({
    error: 'GENERATION_LIMIT_EXCEEDED',
    tier: user.tier,
    limit: GENERATION_LIMITS[user.tier].daily,
    resetTime: getNextResetTime()
  }, 429);
}
```

#### AI Service Unavailable
```typescript
if (!ANTHROPIC_API_KEY) {
  return c.json({
    error: 'AI_SERVICE_UNAVAILABLE',
    message: 'Content generation temporarily disabled'
  }, 503);
}
```

#### Invalid Source Reel
```typescript
if (!reel) {
  return c.json({
    error: 'SOURCE_REEL_NOT_FOUND',
    message: 'The specified reel does not exist'
  }, 404);
}
```

---

## Performance Optimization

### Frontend Optimizations

1. **Debounced Generation**: Prevent multiple rapid requests
2. **Optimistic Updates**: Show pending state immediately
3. **Cached History**: React Query with 5-minute stale time
4. **Lazy Loading**: History items loaded on scroll

### Backend Optimizations

1. **Connection Pooling**: Reuse database connections
2. **AI Request Batching**: Future enhancement for bulk generation
3. **Response Caching**: Cache generation results for identical prompts
4. **Background Processing**: Queue expensive AI operations

### Cost Management

1. **Token Usage Tracking**: Monitor Claude API costs per user
2. **Smart Caching**: Avoid regenerating identical content
3. **Tier Enforcement**: Strict limits prevent cost overruns
4. **Fallback Models**: Use cheaper models for simple requests

---

## Security Considerations

### Input Sanitization

```typescript
const generationSchema = z.object({
  sourceReelId: z.string().uuid(),
  prompt: z.string().min(1).max(1000).transform(sanitizePrompt),
  outputType: z.enum(['full', 'hook', 'caption'])
});

function sanitizePrompt(prompt: string): string {
  // Remove potential prompt injection attempts
  return prompt
    .replace(/ignore\s+previous\s+instructions/gi, '')
    .replace(/system\s*:/gi, '')
    .trim();
}
```

### Content Filtering

```typescript
function filterGeneratedContent(content: GeneratedContent): GeneratedContent {
  // Filter out inappropriate content
  const filtered = {
    ...content,
    generatedHook: filterInappropriate(content.generatedHook),
    generatedCaption: filterInappropriate(content.generatedCaption),
    generatedScript: filterInappropriate(content.generatedScript)
  };
  
  return filtered;
}
```

### Access Control

```typescript
// User can only access their own generations
const whereClause = {
  userId: user.id,
  // Admin can see all
  ...(user.role === 'admin' ? {} : { userId: user.id })
};
```

---

## Monitoring and Analytics

### Metrics to Track

1. **Generation Volume**: Daily/weekly generation counts
2. **AI Costs**: Token usage and API costs per user/tier
3. **Success Rate**: Generation success vs failure rates
4. **Popular Prompts**: Most common generation prompts
5. **Output Quality**: User feedback and ratings

### Logging Strategy

```typescript
// Structured logging for monitoring
logger.info('generation_request', {
  userId: user.id,
  userTier: user.tier,
  sourceReelId,
  promptLength: prompt.length,
  outputType,
  timestamp: new Date().toISOString()
});

logger.info('generation_success', {
  userId: user.id,
  generationId: content.id,
  tokensUsed: result.usage.totalTokens,
  cost: result.usage.totalTokens * 0.000015,
  duration: Date.now() - startTime
});
```

---

## Future Enhancements

### Planned Features

1. **Batch Generation**: Generate multiple variants at once
2. **Template Library**: Pre-built prompt templates
3. **Style Transfer**: Adapt content for different platforms
4. **Collaborative Generation**: Team workspace features
5. **Performance Analytics**: Track generated content performance

### Technical Improvements

1. **Streaming Responses**: Real-time generation streaming
2. **Model Selection**: Choose AI model based on complexity
3. **Federated Learning**: Improve prompts based on success patterns
4. **Multi-language Support**: Generate content in different languages

---

## Related Documentation

- [Studio System](./studio-system.md) - Overall studio architecture
- [API Architecture](../core/api.md) - General API patterns
- [Security](../core/security.md) - Security best practices
- [Error Handling](../core/error-handling.md) - Error handling patterns

---

*Last Updated: March 2026*
