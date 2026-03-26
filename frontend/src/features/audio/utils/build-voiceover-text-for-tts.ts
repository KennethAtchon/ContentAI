export interface VoiceoverTextInput {
  generatedHook: string | null;
  cleanScriptForAudio: string | null;
}

function extractBody(cleanScriptForAudio: string | null): string {
  const source = (cleanScriptForAudio ?? "").trim();
  if (!source) return "";
  return source
    .replace(/^\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Compose default spoken TTS text: hook (if present) prepended to clean body
 * (deduped). Does NOT include generated_caption.
 *
 * Mirror of backend/src/shared/services/voiceover-text-for-tts.ts —
 * keep behavior aligned via duplicated tests.
 */
export function buildVoiceoverTextForTts(input: VoiceoverTextInput): string {
  const hookNorm = normalizeCopy(input.generatedHook);
  const cleanNorm = normalizeCopy(extractBody(input.cleanScriptForAudio));

  const parts: string[] = [];
  if (hookNorm) parts.push(hookNorm);
  if (cleanNorm && cleanNorm !== hookNorm) parts.push(cleanNorm);
  return parts.join("\n\n");
}
