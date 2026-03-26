import { extractCaptionSourceText } from "../../routes/video/utils";

export interface VoiceoverTextInput {
  generatedHook: string | null;
  cleanScriptForAudio: string | null;
}

function normalizeCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Compose default spoken TTS text: hook (if present) prepended to clean body
 * (deduped). Does NOT include generated_caption — overlay track uses that
 * separately via composeCaptionOverlayText.
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
      cleanScriptForAudio: input.cleanScriptForAudio,
      generatedScript: null,
    }),
  );

  const parts: string[] = [];
  if (hookNorm) parts.push(hookNorm);
  if (cleanNorm && cleanNorm !== hookNorm) parts.push(cleanNorm);
  return parts.join("\n\n");
}
