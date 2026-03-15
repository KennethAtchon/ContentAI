import { ELEVENLABS_API_KEY } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import type { VoiceConfig } from "../../config/voices";

export type TTSSpeed = "slow" | "normal" | "fast";

const SPEED_SETTINGS: Record<TTSSpeed, { stability: number; speed: number }> = {
  slow: { stability: 0.75, speed: 0.8 },
  normal: { stability: 0.5, speed: 1.0 },
  fast: { stability: 0.5, speed: 1.2 },
};

// Strips markdown formatting from text for cleaner TTS output
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/^\s*[-*+]\s/gm, "") // unordered lists
    .replace(/^\s*\d+\.\s/gm, "") // ordered lists
    .replace(/>\s/g, "") // blockquotes
    .replace(/---+/g, "") // horizontal rules
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/\|.+\|/g, "") // tables
    .trim();
}

export interface TTSResult {
  audioBuffer: Buffer;
  durationMs: number;
}

export async function generateSpeech(
  text: string,
  voice: VoiceConfig,
  speed: TTSSpeed,
): Promise<TTSResult> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const settings = SPEED_SETTINGS[speed];
  const cleanText = stripMarkdown(text);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenLabsId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: settings.stability,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
          speed: settings.speed,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    debugLog.error("ElevenLabs TTS API error", {
      service: "elevenlabs-tts",
      operation: "generateSpeech",
      status: response.status,
      error: errorText,
    });
    throw new Error(`TTS_PROVIDER_ERROR: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Estimate duration from buffer size (mp3 at ~128kbps = 16000 bytes/second)
  const durationMs = Math.round((audioBuffer.length / 16000) * 1000);

  return { audioBuffer, durationMs };
}
