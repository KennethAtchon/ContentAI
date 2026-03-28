/**
 * Splits a text string into timed segments for display in a text clip.
 *
 * Strategy (coarsest to finest):
 * 1. Split by sentence boundaries (.!?)
 * 2. If any segment exceeds MAX_WORDS, split further by clause boundaries (,;:)
 * 3. If still exceeds MAX_WORDS, chunk into groups of CHUNK_SIZE words
 *
 * Time is distributed proportionally to word count so longer segments
 * get more screen time.
 */

const MAX_WORDS = 5;
const CHUNK_SIZE = 4;
const WORDS_PER_SECOND = 2.5; // comfortable on-screen reading pace
const MIN_READING_DURATION_MS = 2000;

/**
 * Estimates how long a text clip should run based on its word count.
 * Returns undefined for empty text (no constraint should apply).
 */
export function estimateReadingDurationMs(text: string): number | undefined {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return undefined;
  return Math.max(MIN_READING_DURATION_MS, Math.ceil(words / WORDS_PER_SECOND) * 1000);
}

export interface TextSegment {
  text: string;
  startMs: number;
  endMs: number;
}

function chunkByWords(text: string, chunkSize: number): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

function splitIntoRawSegments(text: string): string[] {
  // Step 1: sentence boundaries
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    if (words <= MAX_WORDS) {
      segments.push(sentence);
      continue;
    }

    // Step 2: clause boundaries
    const clauses = sentence
      .split(/(?<=[,;:])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      if (clause.split(/\s+/).length <= MAX_WORDS) {
        segments.push(clause);
      } else {
        // Step 3: word chunks
        segments.push(...chunkByWords(clause, CHUNK_SIZE));
      }
    }
  }

  return segments.length > 0 ? segments : [text.trim()];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length || 1;
}

export function splitTextIntoSegments(
  text: string,
  durationMs: number
): TextSegment[] {
  const raw = splitIntoRawSegments(text);
  const totalWords = raw.reduce((sum, s) => sum + wordCount(s), 0);
  const msPerWord = durationMs / totalWords;

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const s of raw) {
    const wc = wordCount(s);
    const segDuration = wc * msPerWord;
    segments.push({ text: s, startMs: cursor, endMs: cursor + segDuration });
    cursor += segDuration;
  }

  return segments;
}

export function getActiveSegment(
  segments: TextSegment[],
  elapsedMs: number
): string {
  for (const seg of segments) {
    if (elapsedMs >= seg.startMs && elapsedMs < seg.endMs) return seg.text;
  }
  // Clamp to last segment when at/past end
  return segments[segments.length - 1]?.text ?? "";
}

/** Preview-only: full text when `textAutoChunk === false`, else timed chunks from {@link splitTextIntoSegments}. */
export function getTextClipPreviewDisplay(
  text: string,
  durationMs: number,
  elapsedMs: number,
  textAutoChunk?: boolean
): string {
  if (textAutoChunk === false) return text;
  const segments = splitTextIntoSegments(text, durationMs);
  return getActiveSegment(segments, elapsedMs);
}
