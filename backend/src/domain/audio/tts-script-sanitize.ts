/**
 * Strip production metadata from a script before sending to TTS.
 * Removes timing markers ([0-3s]), stage directions in parens, section labels,
 * bullet markers, and collapses excess whitespace.
 */
export function sanitizeScriptForTTS(text: string): string {
  return text
    .replace(/\[\d+[:\-]\d+s?\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/^\s*[-•*]\s*/gm, "")
    .replace(/^\s*\w[\w\s]*:\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
