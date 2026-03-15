/**
 * Seed script: generate and upload voice preview audio files to R2.
 *
 * Run with:  bun run seed:voice-previews
 *
 * Requires ELEVENLABS_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to be set in .env.
 */

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { VOICES } from "../src/config/voices";

// ── env ────────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (
  !ELEVENLABS_API_KEY ||
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  console.error(
    "Missing required env vars: ELEVENLABS_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Short, distinct preview sentences per voice
const PREVIEW_TEXTS: Record<string, string> = {
  "aria-v1": "Hey, welcome back! Let's create something amazing together.",
  "marcus-v1": "Here's what you need to know to grow your brand fast.",
  "luna-v1": "Let's go! This is your sign to start creating today.",
  "james-v1": "In today's video, I'll show you exactly how it's done.",
  "nova-v1": "Every great story starts with a single moment. This is yours.",
};

async function generatePreview(
  elevenLabsId: string,
  text: string,
): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text().catch(() => "unknown");
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadToR2(key: string, buffer: Buffer): Promise<void> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
    },
  });
  await upload.done();
}

async function main() {
  console.log(`Seeding ${VOICES.length} voice previews...\n`);

  for (const voice of VOICES) {
    if (!voice.previewR2Key) {
      console.log(`  [skip] ${voice.name} — no previewR2Key configured`);
      continue;
    }

    const text = PREVIEW_TEXTS[voice.id] ?? `Hi, I'm ${voice.name}.`;
    process.stdout.write(`  ${voice.name} (${voice.id})... `);

    try {
      const buffer = await generatePreview(voice.elevenLabsId, text);
      await uploadToR2(voice.previewR2Key, buffer);
      console.log(
        `✓ uploaded to ${voice.previewR2Key} (${buffer.length} bytes)`,
      );
    } catch (err) {
      console.log(`✗ failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\nDone.");
}

main();
