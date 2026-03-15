// Internal voice config mapping frontend IDs to ElevenLabs IDs
export interface VoiceConfig {
  id: string; // frontend ID (e.g. "aria-v1")
  name: string;
  description: string;
  gender: "male" | "female" | "neutral";
  elevenLabsId: string; // ElevenLabs voice ID
  previewR2Key?: string; // R2 key for preview audio (optional until uploaded)
}

export const VOICES: VoiceConfig[] = [
  {
    id: "rachel-v1",
    name: "Rachel",
    description:
      "Warm, conversational female voice. Great for lifestyle and wellness content.",
    gender: "female",
    elevenLabsId: "21m00Tcm4TlvDq8ikWAM", // ElevenLabs "Rachel"
    previewR2Key: "voices/rachel-preview.mp3",
  },
  {
    id: "marcus-v1",
    name: "Marcus",
    description:
      "Deep, authoritative male voice. Works well for educational and business content.",
    gender: "male",
    elevenLabsId: "N2lVS1w4EtoT3dr4eOWO", // ElevenLabs "Callum"
    previewR2Key: "voices/marcus-preview.mp3",
  },
  {
    id: "elli-v1",
    name: "Elli",
    description:
      "Bright, energetic female voice. Perfect for motivational and fitness content.",
    gender: "female",
    elevenLabsId: "MF3mGyEYCl7XYWbV9V6O", // ElevenLabs "Elli"
    previewR2Key: "voices/elli-preview.mp3",
  },
  {
    id: "james-v1",
    name: "James",
    description:
      "Clear, professional male voice. Ideal for business and tutorial content.",
    gender: "male",
    elevenLabsId: "bIHbv24MWmeRgasZH58o", // ElevenLabs "Will"
    previewR2Key: "voices/james-preview.mp3",
  },
  {
    id: "nova-v1",
    name: "Nova",
    description:
      "Soft, friendly neutral voice. Great for storytelling and personal content.",
    gender: "neutral",
    elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", // ElevenLabs "Lily"
    previewR2Key: "voices/nova-preview.mp3",
  },
];

export function getVoiceById(id: string): VoiceConfig | undefined {
  return VOICES.find((v) => v.id === id);
}
