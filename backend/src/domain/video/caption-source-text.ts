/** Plain caption / voiceover body from stored script fields (strips timing tags). */
export function extractCaptionSourceText(input: {
  voiceoverScript: string | null;
  generatedScript: string | null;
}): string {
  const source = (input.voiceoverScript ?? input.generatedScript ?? "").trim();
  if (!source) return "";
  return source
    .replace(/^\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
