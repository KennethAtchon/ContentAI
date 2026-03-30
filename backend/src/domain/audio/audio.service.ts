import { getVoiceById, VOICES } from "../../config/voices";
import { recordAiCost } from "../../lib/cost-tracker";
import { deleteFile, getFileUrl, uploadFile } from "../../services/storage/r2";
import { generateSpeech, type TTSSpeed } from "../../services/tts/elevenlabs";
import { sanitizeScriptForTTS } from "./tts-script-sanitize";
import { R2_PUBLIC_URL } from "../../utils/config/envUtil";
import { AppError, Errors } from "../../utils/errors/app-error";
import type { IAssetsRepository } from "../assets/assets.repository";
import type { IAudioRepository } from "./audio.repository";

export class AudioService {
  constructor(
    private readonly audio: IAudioRepository,
    private readonly assets: IAssetsRepository,
  ) {}

  async listTrendingAudio(query: {
    days: number;
    limit: number;
    nicheId?: number;
  }) {
    const rows = await this.audio.listTrendingAudio(query);
    const audio = rows.map((row) => {
      const current = row.useCount ?? 0;
      const previous = row.prevCount ?? 0;
      const trend =
        current > previous
          ? "rising"
          : current < previous
            ? "declining"
            : "stable";

      return {
        audioId: row.audioId,
        audioName: row.audioName,
        artistName: row.artistName,
        useCount: current,
        lastSeen: row.lastSeen,
        trend,
      };
    });
    return { audio };
  }

  listVoicesWithPreviewUrls() {
    const voicesWithUrls = VOICES.map((voice) => {
      let previewUrl = "";
      if (voice.previewR2Key && R2_PUBLIC_URL) {
        previewUrl = `${R2_PUBLIC_URL}/${voice.previewR2Key}`;
      }
      return {
        id: voice.id,
        name: voice.name,
        description: voice.description,
        gender: voice.gender,
        previewUrl,
        provider: "elevenlabs" as const,
      };
    });
    return { voices: voicesWithUrls };
  }

  async generateVoiceover(params: {
    userId: string;
    generatedContentId: number;
    text: string;
    voiceId: string;
    speed: TTSSpeed;
  }) {
    const { userId, generatedContentId, text, voiceId, speed } = params;

    const content = await this.audio.findGeneratedContentForUser(
      generatedContentId,
      userId,
    );
    if (!content) throw Errors.notFound("Content");

    const voice = getVoiceById(voiceId);
    if (!voice) {
      throw new AppError("Invalid voiceId", "INVALID_VOICE", 400);
    }

    const existingAsset = await this.audio.findVoiceoverAssetForContent(
      generatedContentId,
    );
    if (existingAsset?.r2Key) {
      await deleteFile(existingAsset.r2Key).catch(() => {});
    }
    if (existingAsset) {
      await this.audio.deleteVoiceoverLinkAndAsset(
        generatedContentId,
        existingAsset.id,
      );
    }

    const spokenText = sanitizeScriptForTTS(text);
    if (!spokenText) {
      throw new AppError(
        "Script is empty after removing stage directions",
        "EMPTY_TEXT",
        400,
      );
    }

    const startMs = Date.now();
    const { audioBuffer, durationMs } = await generateSpeech(
      spokenText,
      voice,
      speed,
    );
    const generationMs = Date.now() - startMs;

    const assetId = crypto.randomUUID();
    const r2Key = `audio/voiceovers/${userId}/${assetId}.mp3`;
    await uploadFile(audioBuffer, r2Key, "audio/mpeg");

    const asset = await this.assets.insertAsset({
      id: assetId,
      userId,
      type: "voiceover",
      source: "tts",
      r2Key,
      r2Url: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${r2Key}` : null,
      durationMs,
      metadata: {
        voiceId,
        voiceName: voice.name,
        speed,
        provider: "elevenlabs",
        characterCount: spokenText.length,
        volumeBalance: 70,
      },
    });

    await this.audio.insertVoiceoverContentLink(generatedContentId, asset.id);

    const costUsd = (spokenText.length / 1000) * 0.3;
    recordAiCost({
      userId,
      provider: "openai",
      model: "eleven_multilingual_v2",
      featureType: "tts",
      inputTokens: 0,
      outputTokens: 0,
      durationMs: generationMs,
      metadata: {
        characterCount: spokenText.length,
        voiceId,
        durationMs,
        costUsd,
      },
    }).catch(() => {});

    const audioUrl = await getFileUrl(r2Key, 3600);
    return { asset, audioUrl };
  }
}
