export function buildAIAssemblyPrompt({
  shots,
  platform,
  targetDurationMs,
}: {
  shots: Array<{ index: number; description: string; durationMs: number }>;
  platform: string;
  targetDurationMs: number;
}): string {
  return `You are a professional short-form video editor specializing in ${platform} content.

Given these video shots, create an optimal timeline arrangement.

SHOTS:
${shots.map((s) => `[${s.index}] "${s.description}" (${s.durationMs}ms available)`).join("\n")}

PLATFORM: ${platform}
TARGET DURATION: ${targetDurationMs}ms

RULES:
1. Hook the viewer in the first 1.5 seconds — use the most visually striking shot first.
2. Total duration should be ${targetDurationMs}ms +/- 20%.
3. Vary shot duration (2000-5000ms) to maintain visual interest.
4. Place call-to-action shots near the end.
5. Use transitions sparingly — prefer hard cuts, max 2 fades per video.
6. Shot indices must be valid (0 to ${shots.length - 1}).
7. trimStartMs must be >= 0. trimEndMs must be <= the shot's available duration.
8. trimEndMs must be > trimStartMs.
9. Every shot index should appear in cuts at least once unless the video needs to be shorter.

Respond ONLY with a JSON object in this exact structure, no explanation:
\`\`\`json
{
  "shotOrder": [array of shot indices in display order],
  "cuts": [
    {
      "shotIndex": number,
      "trimStartMs": number,
      "trimEndMs": number,
      "transition": "cut" | "fade" | "slide-left" | "dissolve"
    }
  ],
  "musicVolume": 0.25,
  "totalDuration": number
}
\`\`\``;
}
