import OpenAI from "openai";
import type { Token } from "../../infrastructure/database/drizzle/schema";
import { getFileUrl } from "../../services/storage/r2";
import { OPENAI_API_KEY } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import { AppError, Errors } from "../../utils/errors/app-error";
import type { IAssetsRepository } from "../assets/assets.repository";
import type { ICaptionsRepository } from "./captions.repository";
import type {
  CaptionPresetRecord,
  ICaptionPresetRepository,
} from "./captions/preset.repository";

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

export class CaptionsService {
  private readonly openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  constructor(
    private readonly assets: IAssetsRepository,
    private readonly captions: ICaptionsRepository,
    private readonly presets: ICaptionPresetRepository,
  ) {}

  async getCaptionsForAsset(userId: string, assetId: string) {
    const caption = await this.captions.findByAssetAndUser(assetId, userId);
    if (!caption) {
      throw new AppError(
        "No captions found for this asset",
        "NOT_FOUND",
        404,
      );
    }
    return {
      captionDocId: caption.id,
      tokens: caption.tokens,
      fullText: caption.fullText,
      source: caption.source,
    };
  }

  async getCaptionDoc(userId: string, captionDocId: string) {
    const caption = await this.captions.findByIdAndUser(captionDocId, userId);
    if (!caption) {
      throw new AppError(
        "No caption doc found",
        "NOT_FOUND",
        404,
      );
    }

    return {
      captionDocId: caption.id,
      tokens: caption.tokens,
      fullText: caption.fullText,
      language: caption.language,
      source: caption.source,
    };
  }

  async createManual(
    userId: string,
    input: {
      assetId: string | null;
      tokens: Token[];
      fullText: string;
      language: "en";
    },
  ) {
    const saved = await this.captions.insert({
      userId,
      assetId: input.assetId,
      language: input.language,
      tokens: input.tokens,
      source: "manual",
      fullText: input.fullText,
    });

    return { captionDocId: saved.id };
  }

  async updateCaptionDoc(
    userId: string,
    captionDocId: string,
    input: {
      tokens: Token[];
      fullText: string;
      language: "en";
    },
  ) {
    const updated = await this.captions.updateByIdAndUser(captionDocId, userId, {
      tokens: input.tokens,
      fullText: input.fullText,
      language: input.language,
    });
    if (!updated) throw Errors.notFound("Caption doc");

    return {
      captionDocId: updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async listPresets(): Promise<CaptionPresetRecord[]> {
    return this.presets.listCaptionPresets();
  }

  async transcribeAsset(
    userId: string,
    assetId: string,
    options?: { force?: boolean },
  ) {
    const asset = await this.assets.findByIdForUser(assetId, userId);
    if (!asset) throw Errors.notFound("Asset");

    if (!["voiceover", "audio"].includes(asset.type)) {
      throw new AppError(
        `Asset type "${asset.type}" is not supported. Must be "voiceover" or "audio".`,
        "CAPTION_ASSET_TYPE",
        400,
      );
    }

    if (!asset.r2Key) {
      throw new AppError(
        "Asset has no associated file",
        "CAPTION_NO_FILE",
        400,
      );
    }

    const existing = await this.captions.findByAssetAndUser(assetId, userId);
    if (existing && !options?.force) {
      return {
        captionDocId: existing.id,
        tokens: existing.tokens,
        fullText: existing.fullText,
      };
    }

    let audioBuffer: Buffer;
    try {
      const signedUrl = await getFileUrl(asset.r2Key, 3600);
      const res = await fetch(signedUrl);
      if (!res.ok) {
        throw new Error(`R2 download failed: HTTP ${res.status}`);
      }
      audioBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      debugLog.error("Failed to download audio from R2", {
        service: "captions-service",
        operation: "downloadAudio",
        assetId,
        r2Key: asset.r2Key,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw Errors.internal("Failed to download audio file");
    }

    if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
      throw new AppError(
        `Audio file is ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB. Maximum is 25 MB.`,
        "CAPTION_AUDIO_TOO_LARGE",
        413,
      );
    }

    let transcription: OpenAI.Audio.Transcription & {
      words?: Array<{ word: string; start: number; end: number }>;
    };
    try {
      const mimeType = asset.mimeType ?? "audio/mpeg";
      const ext = mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "m4a"
          : "mp3";

      transcription = (await this.openai.audio.transcriptions.create({
        file: new File([new Uint8Array(audioBuffer)], `audio.${ext}`, {
          type: mimeType,
        }),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      })) as typeof transcription;
    } catch (err) {
      debugLog.error("Whisper API call failed", {
        service: "captions-service",
        operation: "whisperTranscribe",
        assetId,
        error: err instanceof Error ? err.message : "Unknown error",
      });

      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("too short") || message.includes("too long")) {
        throw new AppError(
          `Whisper rejected the audio: ${message}`,
          "WHISPER_REJECTED",
          422,
        );
      }
      if (message.includes("format")) {
        throw new AppError(
          "Unsupported audio format. Whisper supports mp3, mp4, m4a, wav, and webm.",
          "WHISPER_FORMAT",
          422,
        );
      }
      throw new AppError("Transcription failed", "WHISPER_FAILED", 502);
    }

    const whisperWords = transcription.words ?? [];
    const words: Token[] = whisperWords.map(
      (w: { word: string; start: number; end: number }) => ({
        text: w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      }),
    );

    const saved = existing
      ? await this.captions.updateByIdAndUser(existing.id, userId, {
          tokens: words,
          fullText: transcription.text ?? "",
          language: "en",
        })
      : await this.captions.insert({
          userId,
          assetId,
          language: "en",
          tokens: words,
          source: "whisper",
          fullText: transcription.text ?? "",
        });
    if (!saved) throw Errors.notFound("Caption doc");

    debugLog.info("Caption transcription completed", {
      service: "captions-service",
      operation: "transcribe",
      assetId,
      wordCount: words.length,
    });

    return {
      captionDocId: saved.id,
      tokens: saved.tokens,
      fullText: saved.fullText,
    };
  }
}
