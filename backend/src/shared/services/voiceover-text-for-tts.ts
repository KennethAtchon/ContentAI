import { extractCaptionSourceText } from "../../routes/video/utils";

export interface VoiceoverTextInput {
  generatedHook: string | null;
  voiceoverScript: string | null;
}

function normalizeCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Compose default spoken TTS text: hook (if present) prepended to clean body
 * (deduped). Does NOT include post_caption (social-only; never on overlay text).
 *
 * Rules:
 * - Both hook and body: "hook\n\nbody" (deduped: body omitted when equal to hook)
 * - Hook only: hook
 * - Body only: body
 * - Neither: ""
 */
export function buildVoiceoverTextForTts(input: VoiceoverTextInput): string {
  const hookNorm = normalizeCopy(input.generatedHook);
  const cleanNorm = normalizeCopy(
    extractCaptionSourceText({
      voiceoverScript: input.voiceoverScript,
      generatedScript: null,
    }),
  );

  const parts: string[] = [];
  if (hookNorm) parts.push(hookNorm);
  if (cleanNorm && cleanNorm !== hookNorm) parts.push(cleanNorm);
  return parts.join("\n\n");
}
