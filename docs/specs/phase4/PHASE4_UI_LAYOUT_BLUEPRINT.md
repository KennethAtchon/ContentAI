# Phase 4 UI Layout Blueprint

Last updated: 2026-03-15
Related:
- `docs/specs/PHASE4_VIDEO_PRODUCTION_MVP.md`
- `docs/specs/PHASE4_TECHNICAL_DESIGN.md`
- `docs/specs/PHASE4_API_AND_FLOW_CONTRACTS.md`
- `docs/specs/PHASE4_UI_STATES_AND_WIREFLOWS.md`

## Purpose

Define concrete page-level layout for Phase 4 video production so frontend implementation can ship a consistent AI-first experience across desktop and mobile.

## System Settings and User Preferences

### Account Dashboard Settings

Users should have access to a settings page where they can configure their video generation preferences:

#### Video Generation Settings

- **Default Provider**: User's preferred video generation service
  - Options: `kling-fal`, `runway`, `image-ken-burns`
  - Display provider info: cost per clip, typical quality, generation speed
  - Auto-fallback behavior when provider unavailable

- **Quality vs Cost Balance**: Slider or preset selection
  - `Fast & Affordable` (shorter clips, image-ken-burns fallback)
  - `Balanced` (default kling-fal)
  - `Premium Quality` (runway, longer generation time)

- **Default Aspect Ratio**: `9:16` (mobile), `16:9` (desktop), `1:1` (social)
- **Default Clip Duration**: 3-10 seconds range with smart defaults
- **Auto-Captions**: Enable/disable by default
- **Clip Audio Preference**: Default choice for shots with embedded audio

#### Account-Level Preferences

- **Cost Alerts**: Monthly spending limits and notifications
- **Generation History**: Keep/delete preferences for past projects
- **API Key Management**: For users bringing their own provider keys
- **Export Quality**: Default resolution and compression settings

### Settings Storage Schema

Extend `user` table or create `user_preferences` table:

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'video_generation', 'ui', 'notifications'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, category, key)
);
```

### Settings API Endpoints

```typescript
// GET /api/user/settings?category=video_generation
// PATCH /api/user/settings
{
  "video_generation": {
    "defaultProvider": "kling-fal",
    "qualityMode": "balanced",
    "defaultAspectRatio": "9:16",
    "defaultClipDuration": 5,
    "autoCaptions": true,
    "clipAudioDefault": false
  }
}
```

### Integration with Phase 4

- Generate Reel form uses user's default provider selection
- Storyboard shows current provider with option to change per-shot
- Settings accessible from Generate workspace header
- Provider selection impacts cost estimates shown to user

## Information Architecture

Phase 4 UI should run as one continuous workspace with three major regions:

1. `Generate` (AI-first start and progress)
2. `Storyboard` (optional per-shot override)
3. `Final Preview` (player, download, and re-assemble)

Recommended route shape:

- `/(customer)/generate/$generatedContentId/reel`
- `/(customer)/settings` (new settings page)

The route keeps a stable shell while regions swap by state.

## Screen Architecture

## 1) Generate Reel Flow

### Desktop Layout (>= 1024px)

- **Header row**: page title, status chip, settings link, secondary actions (`Back to Script`, `Open Assets`).
- **Main grid (12 cols)**:
  - `col-span-8`: primary status panel with large progress indicator, current phase label, estimate, and logs/tips.
  - `col-span-4`: right context column with script summary, selected audio assets, and guardrail note.
- **Footer action bar**:
  - primary `Generate Reel`
  - secondary `Review Storyboard` (disabled until at least one shot exists)
  - tertiary `Cancel` (only while queued/generating)

### Mobile Layout (< 1024px)

- Sticky compact header with title + status chip.
- Single-column vertical flow:
  1. primary status card
  2. script/audio summary accordion
  3. action stack (`Generate Reel`, `Cancel`)
- Use bottom sticky action container with safe-area padding to keep CTA visible.

## 2) Storyboard Override

### Desktop Layout (>= 1024px)

- **Top bar**: `Storyboard` title, completion ratio, provider selection dropdown, `Re-assemble` primary CTA.
- **Main split**:
  - `left 8/12`: shot list board (virtualized list if > 8 shots).
  - `right 4/12`: selected-shot inspector.
- **Shot card structure**:
  - index badge, thumbnail, duration, source badge (`AI` / `Upload`)
  - quick actions: `Preview`, `Regenerate`, `Upload Replacement`
  - overflow menu: `Duplicate Prompt`, `Reset to AI`
- **Inspector panel**:
  - prompt text
  - provider selection (override default)
  - cost estimate for regeneration
  - source metadata
  - upload constraints and last-updated time
  - **Use this clip's audio** toggle (when clip has embedded audio): on = include clip audio in mix; off = voiceover only for this shot

### Mobile Layout (< 1024px)

- Shot list in single-column cards.
- Selecting a card opens an inspector bottom sheet (80vh).
- `Re-assemble` remains sticky at bottom once any override changes exist.
- For upload/regenerate actions, use full-width buttons (min 44px height).

## 3) Final Preview

### Desktop Layout (>= 1024px)

- **Hero player region** (`8/12`): video player with timeline scrub + caption visibility toggle.
- **Meta + actions region** (`4/12`):
  - output summary (duration, render time, version)
  - `Download MP4` primary CTA
  - `Create New Version` secondary CTA
  - `Back to Storyboard` text action
- **Version history strip** under player (horizontal cards).

### Mobile Layout (< 1024px)

- Player first, full width, fixed 16:9.
- Action stack directly below player.
- Version history becomes horizontal swipe chips.
- Keep `Download MP4` as first visible action without scrolling beyond fold.

## Component Tree and Region Responsibilities

## Route-Level Component Tree

```text
ReelWorkspacePage
  ReelWorkspaceHeader
  ReelWorkspaceShell
    ReelStateGate
      GeneratePanel
        GeneratePrimaryCard
        GenerationProgressTimeline
        ContentReadinessSummary
      StoryboardPanel
        StoryboardToolbar
        ShotList
          ShotCard
        ShotInspector
          ShotPreview
          ShotPromptEditor
          ShotActions
      FinalPreviewPanel
        FinalVideoPlayer
        ReelMetaCard
        ReelActions
        ReelVersionHistory
  ReelToastRegion
  ReelBlockingModalRegion
```

## Region Responsibilities

| Region | Responsibility | Must Not Do |
| --- | --- | --- |
| `ReelWorkspaceHeader` | global navigation, status at-a-glance | host primary editing controls |
| `GeneratePanel` | kickoff and monitor AI generation lifecycle | show shot-level override controls |
| `StoryboardPanel` | per-shot override, inspect, and prepare re-assembly | trigger final download |
| `FinalPreviewPanel` | playback, quality confirmation, download/versioning | mutate shot prompts directly |
| `ReelToastRegion` | non-blocking feedback (`upload success`, `retry queued`) | display critical failures only |
| `ReelBlockingModalRegion` | blocking errors and destructive confirms | show progress polling |

## Layout Rules (Implementation Constraints)

- Keep one primary CTA per region to preserve AI-first hierarchy.
- Never hide job state; status chip must be visible in all three regions.
- Persist user context when switching regions (selected shot, scroll, inspector tab).
- Avoid full-page rerenders during polling; update local subregions only.
