/**
 * Seed script: generate and upload voice preview audio files to R2.
 *
 * Run with:  bun run seed:voice-previews
 *            bun run seed:voice-previews --dry-run   (preview without API calls)
 *
 * Requires ELEVENLABS_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to be set in .env.
 *
 * Files are uploaded under a "testing/" prefix when APP_ENV=development,
 * matching the same prefix logic used by the app's r2.ts service.
 */

import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { VOICES } from "../src/config/voices";

// ── flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

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
  "jessica-v1": "Hey, welcome back! Let's create something amazing together.",
  "marcus-v1": "Here's what you need to know to grow your brand fast.",
  "laura-v1": "Let's go! This is your sign to start creating today.",
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

async function checkIfExistsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME!, Key: key }));
    return true;
  } catch (error: any) {
    if (
      error.$metadata?.httpStatusCode === 404 ||
      error.name === "NotFound" ||
      error.name === "NoSuchKey"
    ) {
      return false;
    }
    throw error;
  }
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
  if (DRY_RUN) console.log(`[dry-run] no API calls or uploads will be made\n`);

  console.log(`Seeding ${VOICES.length} voice previews...\n`);

  for (const voice of VOICES) {
    if (!voice.previewR2Key) {
      console.log(`  [skip] ${voice.name} — no previewR2Key configured`);
      continue;
    }

    const r2Key = voice.previewR2Key;
    const text = PREVIEW_TEXTS[voice.id] ?? `Hi, I'm ${voice.name}.`;
    process.stdout.write(`  ${voice.name} (${voice.id}) → ${r2Key}... `);

    if (DRY_RUN) {
      // Check existence without generating audio
      const exists = await checkIfExistsInR2(r2Key);
      console.log(exists ? "✓ already exists" : "✗ missing (would upload)");
      continue;
    }

    try {
      const exists = await checkIfExistsInR2(r2Key);
      if (exists) {
        console.log(`✓ already exists`);
        continue;
      }

      const buffer = await generatePreview(voice.elevenLabsId, text);
      await uploadToR2(r2Key, buffer);
      console.log(`✓ uploaded (${buffer.length} bytes)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`✗ failed: ${errorMessage}`);
    }
  }

  console.log("\nDone.");
}

main();
