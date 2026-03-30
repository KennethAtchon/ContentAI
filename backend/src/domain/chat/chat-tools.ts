import { tool } from "ai";
import { z } from "zod";
import { debugLog } from "../../utils/debug/debug";
import type { HonoEnv } from "../../types/hono.types";
import { resolveChainTip } from "../queue/pipeline/content-chain";
import { chatToolsRepository } from "../singletons";
import { VOICES, getVoiceById } from "../../config/voices";
import { OPENAI_API_KEY, FAL_API_KEY } from "../../utils/config/envUtil";
import { generateSpeech } from "../../services/tts/elevenlabs";
import { uploadFile, deleteFile } from "../../services/storage/r2";
import { buildVoiceoverTextForTts } from "../../shared/services/voiceover-text-for-tts";
import { sanitizeScriptForTTS } from "../../shared/services/tts-script-sanitize";
import { recordAiCost } from "../../lib/cost-tracker";
import { videoJobService } from "../../services/video/job.service";
import {
  runReelGeneration,
  runShotRegenerate,
  getRetryRunner,
} from "../video/reel-job-runner";
import type { VideoProvider } from "../video/video.service";

export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  content: string;
  reelRefs?: number[];
  savedContentId?: number;
}

export function createSaveContentTool(context: ToolContext) {
  return tool({
    description:
      "Save a complete generated content piece (hook, structured script, voiceoverScript, postCaption, hashtags, CTA, sceneDescription) to the database. Call this after writing a full generation. The script field should contain VISUAL descriptions of what to show on screen with timestamps [0-3s], while voiceoverScript should be the spoken narration without timestamps for audio/TTS generation. postCaption is for the social platform post (not on-screen text). sceneDescription sets the overall visual aesthetic for all shots. Never output raw content as plain text — always call this tool.",
    inputSchema: z.object({
      hook: z
        .string()
        .min(10)
        .max(200)
        .describe("Scroll-stopping opening line (1–2 sentences)"),
      script: z
        .string()
        .min(50)
        .describe(
          "Scene-by-scene VISUAL shot list with timing, e.g. [0-3s] Close-up of person looking shocked at phone screen. Describes what to SHOW on screen, not what to say.",
        ),
      voiceoverScript: z
        .string()
        .min(30)
        .describe(
          "Spoken narration without timestamps for audio/TTS — natural speech, no visual cues",
        ),
      sceneDescription: z
        .string()
        .min(10)
        .describe(
          "Overall visual style for the reel, e.g. 'Cinematic documentary style, warm colour grading, handheld camera, close-ups'. Applied to all shots for visual coherence.",
        ),
      postCaption: z.string().min(20).describe("Post caption text with emojis (for social platform post, not on-screen text)"),
      hashtags: z
        .array(z.string())
        .min(3)
        .max(15)
        .describe("3–15 relevant hashtags (without #)"),
      cta: z
        .string()
        .describe("Call-to-action (comment, save, share, follow, etc.)"),
      contentType: z.enum(["hook_only", "caption_only", "full_script"]),
    }),
    execute: async ({
      hook,
      script,
      voiceoverScript,
      sceneDescription,
      postCaption,
      hashtags,
      cta,
      contentType,
    }: {
      hook: string;
      script: string;
      voiceoverScript: string;
      sceneDescription: string;
      postCaption: string;
      hashtags: string[];
      cta: string;
      contentType: "hook_only" | "caption_only" | "full_script";
    }) => {
      debugLog.info("[tool:save_content] Tool invoked", {
        service: "chat-tools",
        operation: "save_content",
        contentType,
        hookLength: hook.length,
        scriptLength: script.length,
        voiceoverScriptLength: voiceoverScript.length,
        postCaptionLength: postCaption.length,
        hashtagCount: hashtags.length,
        userId: context.auth.user.id,
      });
      try {
        const row = await chatToolsRepository.saveNewDraftContentWithQueueItem({
          userId: context.auth.user.id,
          prompt: context.content,
          hook,
          postCaption,
          script,
          voiceoverScript,
          sceneDescription,
          generatedMetadata: { hashtags, cta, contentType },
          outputType: contentType,
        });

        context.savedContentId = row.id;

        debugLog.info("[tool:save_content] Content saved to DB", {
          service: "chat-tools",
          operation: "save_content",
          contentId: row.id,
          userId: context.auth.user.id,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:save_content] Tool failed", {
          service: "chat-tools",
          operation: "save_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createGetReelAnalysisTool(context: ToolContext) {
  return tool({
    description:
      "Fetch detailed analysis data for a reel that was attached to this message. Use this before generating content to understand the reel's hook patterns, emotional triggers, and format. Only call for reels explicitly attached by the user.",
    inputSchema: z.object({
      reelId: z
        .number()
        .describe("The numeric ID of the reel to fetch analysis for"),
    }),
    execute: async ({ reelId }: { reelId: number }) => {
      debugLog.info("[tool:get_reel_analysis] Tool invoked", {
        service: "chat-tools",
        operation: "get_reel_analysis",
        reelId,
        allowedReelRefs: context.reelRefs,
      });
      // Security: only allow reels that were attached to this message
      if (!context.reelRefs || !context.reelRefs.includes(reelId)) {
        debugLog.warn(
          "[tool:get_reel_analysis] Reel not in context — blocked",
          {
            service: "chat-tools",
            operation: "get_reel_analysis",
            reelId,
            allowedReelRefs: context.reelRefs,
          },
        );
        return { error: "reel_not_in_context" };
      }
      try {
        const analysis = await chatToolsRepository.findReelAnalysisForTool(
          reelId,
        );
        if (!analysis) {
          debugLog.info("[tool:get_reel_analysis] No analysis found for reel", {
            service: "chat-tools",
            operation: "get_reel_analysis",
            reelId,
          });
          return {
            error: "no_analysis_found",
            message:
              "No deep analysis available for this reel. Proceed to generate content using only the basic reel info already provided in the context (username, hook, view count).",
          };
        }
        debugLog.info("[tool:get_reel_analysis] Analysis returned", {
          service: "chat-tools",
          operation: "get_reel_analysis",
          reelId,
          hasHookCategory: !!analysis.hookCategory,
          replicabilityScore: analysis.replicabilityScore,
        });
        return analysis;
      } catch (err) {
        debugLog.error("[tool:get_reel_analysis] Tool failed", {
          service: "chat-tools",
          operation: "get_reel_analysis",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createGetContentTool(context: ToolContext) {
  return tool({
    description:
      "Retrieve the full current content for a given content ID. Call this before making targeted edits so you can read all existing fields and understand what to preserve vs change. Also use when the user asks what you previously wrote ('what hashtags did you pick?', 'show me my current caption', etc.).",
    inputSchema: z.object({
      contentId: z.number().describe("The ID of the content piece to retrieve"),
    }),
    execute: async ({ contentId }: { contentId: number }) => {
      debugLog.info("[tool:get_content] Tool invoked", {
        service: "chat-tools",
        operation: "get_content",
        contentId,
        userId: context.auth.user.id,
      });
      try {
        const row = await chatToolsRepository.findContentForGetTool(
          context.auth.user.id,
          contentId,
        );

        if (!row) {
          return { error: "not_found" };
        }

        const meta = row.generatedMetadata as Record<string, unknown> | null;

        debugLog.info("[tool:get_content] Content returned", {
          service: "chat-tools",
          operation: "get_content",
          contentId,
          version: row.version,
        });

        return {
          id: row.id,
          version: row.version,
          outputType: row.outputType,
          status: row.status,
          hook: row.generatedHook,
          postCaption: row.postCaption,
          script: row.generatedScript,
          voiceoverScript: row.voiceoverScript,
          sceneDescription: row.sceneDescription,
          hashtags: meta?.hashtags ?? [],
          cta: meta?.cta ?? null,
          parentId: row.parentId,
          createdAt: row.createdAt,
        };
      } catch (err) {
        debugLog.error("[tool:get_content] Tool failed", {
          service: "chat-tools",
          operation: "get_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createEditContentFieldTool(context: ToolContext) {
  return tool({
    description:
      "Edit one or more specific fields of existing generated content without changing the others. Use this instead of iterate_content when the user wants to change just the postCaption, hook, hashtags, CTA, voiceoverScript, or any single field. Always prefer this over iterate_content when only 1–3 fields are being changed. Call get_content first if you need to read the current values before editing.",
    inputSchema: z.object({
      contentId: z.number().describe("ID of the content piece to edit"),
      edits: z
        .object({
          hook: z.string().max(200).optional(),
          postCaption: z.string().optional(),
          hashtags: z.array(z.string()).min(3).max(15).optional(),
          cta: z.string().optional(),
          script: z.string().optional(),
          voiceoverScript: z.string().optional(),
          sceneDescription: z.string().optional(),
        })
        .describe("Only include the fields being changed"),
      changeDescription: z
        .string()
        .describe(
          'Brief description of what changed, e.g. "shortened caption and made CTA more direct"',
        ),
    }),
    execute: async ({
      contentId,
      edits,
      changeDescription,
    }: {
      contentId: number;
      edits: {
        hook?: string;
        postCaption?: string;
        hashtags?: string[];
        cta?: string;
        script?: string;
        voiceoverScript?: string;
        sceneDescription?: string;
      };
      changeDescription: string;
    }) => {
      debugLog.info("[tool:edit_content_field] Tool invoked", {
        service: "chat-tools",
        operation: "edit_content_field",
        contentId,
        changeDescription,
        fieldsEdited: Object.keys(edits).filter(
          (k) => edits[k as keyof typeof edits] !== undefined,
        ),
        userId: context.auth.user.id,
      });
      try {
        const parent = await chatToolsRepository.findFullGeneratedContentForUser(
          context.auth.user.id,
          contentId,
        );

        if (!parent) {
          return { error: "not_found" };
        }

        const tip = await resolveChainTip(
          parent.id,
          context.auth.user.id,
          chatToolsRepository.client,
        );

        const parentMeta = tip.generatedMetadata as Record<
          string,
          unknown
        > | null;

        const newMetadata = {
          hashtags: edits.hashtags ?? parentMeta?.hashtags,
          cta: edits.cta ?? parentMeta?.cta,
          changeDescription,
        };

        const row = await chatToolsRepository.transactionEditContentNewVersion({
          userId: context.auth.user.id,
          prompt: context.content,
          tip,
          values: {
            sourceReelId: tip.sourceReelId,
            generatedHook: edits.hook ?? tip.generatedHook,
            postCaption: edits.postCaption ?? tip.postCaption,
            generatedScript: edits.script ?? tip.generatedScript,
            voiceoverScript: edits.voiceoverScript ?? tip.voiceoverScript,
            sceneDescription: edits.sceneDescription ?? tip.sceneDescription,
            generatedMetadata: newMetadata,
            outputType: tip.outputType,
            version: tip.version + 1,
            parentId: tip.id,
          },
        });

        context.savedContentId = row.id;

        debugLog.info("[tool:edit_content_field] Edit saved", {
          service: "chat-tools",
          operation: "edit_content_field",
          newContentId: row.id,
          parentId: tip.id,
          version: row.version,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:edit_content_field] Tool failed", {
          service: "chat-tools",
          operation: "edit_content_field",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createIterateContentTool(context: ToolContext) {
  return tool({
    description:
      "Create a new version of an existing piece of generated content. Call this when the user asks to rewrite, heavily rework, or regenerate a full content piece from scratch. For targeted single-field changes (caption only, hashtags only, hook only, CTA only), use edit_content_field instead — it's faster and more precise.",
    inputSchema: z.object({
      parentContentId: z
        .number()
        .describe("The ID of the content piece to iterate on"),
      hook: z.string().max(200).optional(),
      script: z.string().optional(),
      voiceoverScript: z.string().optional(),
      sceneDescription: z.string().optional(),
      postCaption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      changeDescription: z
        .string()
        .describe(
          'Brief description of what changed, e.g. "made hook shorter and more aggressive"',
        ),
    }),
    execute: async ({
      parentContentId,
      hook,
      script,
      voiceoverScript,
      sceneDescription,
      postCaption,
      hashtags,
      cta,
      changeDescription,
    }: {
      parentContentId: number;
      hook?: string;
      script?: string;
      voiceoverScript?: string;
      sceneDescription?: string;
      postCaption?: string;
      hashtags?: string[];
      cta?: string;
      changeDescription: string;
    }) => {
      debugLog.info("[tool:iterate_content] Tool invoked", {
        service: "chat-tools",
        operation: "iterate_content",
        parentContentId,
        changeDescription,
        fieldsOverridden: {
          hook: hook !== undefined,
          script: script !== undefined,
          voiceoverScript: voiceoverScript !== undefined,
          sceneDescription: sceneDescription !== undefined,
          postCaption: postCaption !== undefined,
          hashtags: hashtags !== undefined,
          cta: cta !== undefined,
        },
        userId: context.auth.user.id,
      });
      try {
        const parent = await chatToolsRepository.findFullGeneratedContentForUser(
          context.auth.user.id,
          parentContentId,
        );

        if (!parent) {
          debugLog.warn(
            "[tool:iterate_content] Parent content not found or unauthorized",
            {
              service: "chat-tools",
              operation: "iterate_content",
              parentContentId,
              userId: context.auth.user.id,
            },
          );
          return { error: "not_found" };
        }

        const effectiveParent = await resolveChainTip(
          parent.id,
          context.auth.user.id,
          chatToolsRepository.client,
        );

        debugLog.info(
          "[tool:iterate_content] Parent content found, creating new version",
          {
            service: "chat-tools",
            operation: "iterate_content",
            parentContentId,
            resolvedParentId: effectiveParent.id,
            parentVersion: effectiveParent.version,
            newVersion: effectiveParent.version + 1,
          },
        );

        const parentMeta = effectiveParent.generatedMetadata as Record<
          string,
          unknown
        > | null;

        const row = await chatToolsRepository.transactionIterateContentNewVersion(
          {
            userId: context.auth.user.id,
            prompt: context.content,
            effectiveParent,
            generatedMetadata: {
              hashtags: hashtags ?? parentMeta?.hashtags,
              cta: cta ?? parentMeta?.cta,
              changeDescription,
            },
          },
        );

        context.savedContentId = row.id;

        debugLog.info("[tool:iterate_content] New version saved to DB", {
          service: "chat-tools",
          operation: "iterate_content",
          newContentId: row.id,
          parentContentId,
          version: row.version,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:iterate_content] Tool failed", {
          service: "chat-tools",
          operation: "iterate_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createUpdateContentStatusTool(context: ToolContext) {
  return tool({
    description:
      "Update the status of a piece of generated content. Use when the user says things like 'move this to the queue', 'mark it as ready', 'archive this draft', 'put it back to draft', etc.",
    inputSchema: z.object({
      contentId: z.number().describe("ID of the content to update"),
      status: z
        .enum(["draft", "queued", "archived"])
        .describe("The new status to set"),
    }),
    execute: async ({
      contentId,
      status,
    }: {
      contentId: number;
      status: "draft" | "queued" | "archived";
    }) => {
      debugLog.info("[tool:update_content_status] Tool invoked", {
        service: "chat-tools",
        operation: "update_content_status",
        contentId,
        status,
        userId: context.auth.user.id,
      });
      try {
        const updated = await chatToolsRepository.updateContentStatusForUser(
          context.auth.user.id,
          contentId,
          status,
        );

        if (!updated) {
          return { error: "not_found" };
        }

        debugLog.info("[tool:update_content_status] Status updated", {
          service: "chat-tools",
          operation: "update_content_status",
          contentId,
          status,
        });
        return { success: true as const, contentId, status };
      } catch (err) {
        debugLog.error("[tool:update_content_status] Tool failed", {
          service: "chat-tools",
          operation: "update_content_status",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createSearchContentTool(context: ToolContext) {
  return tool({
    description:
      "Search through the user's previously generated content. Use when the user references past content they want to find, compare, or build on — e.g. 'find the reel about fitness I made last week', 'show me my published captions', 'what content do I have for this reel?'.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Text to search within hooks and captions"),
      status: z
        .enum(["draft", "queued", "processing", "published", "failed"])
        .optional()
        .describe("Filter by content status"),
      limit: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe("Number of results to return (max 10)"),
    }),
    execute: async ({
      query,
      status,
      limit,
    }: {
      query?: string;
      status?: "draft" | "queued" | "processing" | "published" | "failed";
      limit: number;
    }) => {
      debugLog.info("[tool:search_content] Tool invoked", {
        service: "chat-tools",
        operation: "search_content",
        query,
        status,
        limit,
        userId: context.auth.user.id,
      });
      try {
        const rows = await chatToolsRepository.searchUserGeneratedContent({
          userId: context.auth.user.id,
          query,
          status,
          limit,
        });

        debugLog.info("[tool:search_content] Results returned", {
          service: "chat-tools",
          operation: "search_content",
          resultCount: rows.length,
        });

        return { results: rows, total: rows.length };
      } catch (err) {
        debugLog.error("[tool:search_content] Tool failed", {
          service: "chat-tools",
          operation: "search_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createListVoicesTool(_context: ToolContext) {
  return tool({
    description:
      "Return all available TTS voices the user can choose from for voiceover generation. Call this before generate_voiceover if you need to recommend a voice, or when the user asks 'what voices do you have?' / 'which voice should I use?'. Do NOT call this unless it is needed.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        voices: VOICES.map((v) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          gender: v.gender,
        })),
      };
    },
  });
}

export function createGenerateVoiceoverTool(context: ToolContext) {
  return tool({
    description:
      "Generate a voiceover for an existing draft using text-to-speech. Composes spoken text from the draft's hook (prepended) and clean script body (deduped), sends it to ElevenLabs, and attaches the resulting audio to the content. Call this when the user wants to add a voiceover to their content — after save_content has been called and a contentId exists. You must know the voiceId (call list_voices first if needed). Do NOT call this more than once per user request.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID to generate voiceover for"),
      voiceId: z
        .string()
        .describe("The voice ID from list_voices (e.g. 'jessica-v1')"),
      speed: z
        .enum(["slow", "normal", "fast"])
        .default("normal")
        .describe("Speech speed"),
    }),
    execute: async ({ contentId, voiceId, speed }) => {
      try {
        const voice = getVoiceById(voiceId);
        if (!voice) {
          return { success: false as const, reason: "voice_not_found" };
        }

        const content = await chatToolsRepository.findContentVoiceoverSource(
          context.auth.user.id,
          contentId,
        );

        if (!content) return { success: false as const, reason: "not_found" };

        const composed = buildVoiceoverTextForTts({
          generatedHook: content.generatedHook,
          voiceoverScript: content.voiceoverScript,
        });
        const script = sanitizeScriptForTTS(composed);
        if (!script) {
          return { success: false as const, reason: "no_voiceover_text" };
        }

        const { audioBuffer, durationMs } = await generateSpeech(
          script,
          voice,
          speed,
        );

        const r2Key = `voiceovers/${context.auth.user.id}/${contentId}/${Date.now()}.mp3`;
        const r2Url = await uploadFile(audioBuffer, r2Key, "audio/mpeg");

        const existing = await chatToolsRepository.getVoiceoverAttachmentForContent(
          contentId,
        );
        if (existing) {
          if (existing.r2Key) {
            await deleteFile(existing.r2Key).catch(() => {});
          }
          await chatToolsRepository.deleteVoiceoverLinksForContent(contentId);
          await chatToolsRepository
            .deleteAssetById(existing.assetId)
            .catch(() => {});
        }

        const asset = await chatToolsRepository.insertVoiceoverAsset({
          userId: context.auth.user.id,
          r2Key,
          r2Url,
          durationMs,
          metadata: { voiceId, speed },
        });

        await chatToolsRepository.linkVoiceoverAsset(contentId, asset.id);

        const { refreshEditorTimeline } = await import(
          "../routes/editor/services/refresh-editor-timeline"
        );
        await refreshEditorTimeline(contentId, context.auth.user.id).catch(
          (err) =>
            debugLog.warn(
              "refreshEditorTimeline (generate_voiceover tool) failed",
              { err, contentId },
            ),
        );

        void recordAiCost({
          userId: context.auth.user.id,
          provider: "openai",
          model: voice.elevenLabsId,
          featureType: "tts",
          inputTokens: 0,
          outputTokens: 0,
          durationMs,
          metadata: { voiceId, scriptLength: script.length },
        });

        debugLog.info("[tool:generate_voiceover] Voiceover generated", {
          service: "chat-tools",
          operation: "generate_voiceover",
          contentId,
          voiceId,
          durationMs,
        });

        return { success: true as const, assetId: asset.id, durationMs };
      } catch (err) {
        debugLog.error("[tool:generate_voiceover] Failed", {
          service: "chat-tools",
          operation: "generate_voiceover",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "tts_error" };
      }
    },
  });
}

export function createSearchMusicTool(_context: ToolContext) {
  return tool({
    description:
      "Search the music library to find background tracks to recommend to the user. Filter by mood or keyword. Call this when the user asks about music options, or when guiding them through the reel pipeline after voiceover is complete.",
    inputSchema: z.object({
      mood: z
        .enum(["energetic", "calm", "dramatic", "funny", "inspiring"])
        .optional()
        .describe("Filter tracks by mood"),
      search: z
        .string()
        .optional()
        .describe("Keyword search in track name or artist"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of results to return"),
    }),
    execute: async ({ mood, search, limit }) => {
      try {
        const tracks = await chatToolsRepository.searchActiveMusicTracks({
          mood,
          search,
          limit,
        });

        return { tracks };
      } catch (err) {
        debugLog.error("[tool:search_music] Failed", {
          service: "chat-tools",
          operation: "search_music",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { tracks: [] };
      }
    },
  });
}

export function createAttachMusicTool(context: ToolContext) {
  return tool({
    description:
      "Attach a music track from the library to a draft. Replaces any existing music. Call this after the user has selected or approved a track from search_music results. You must have a valid musicTrackId from search_music before calling this.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID to attach music to"),
      musicTrackId: z
        .string()
        .describe("The track ID from search_music results"),
    }),
    execute: async ({ contentId, musicTrackId }) => {
      try {
        const content = await chatToolsRepository.findOwnedContentId(
          context.auth.user.id,
          contentId,
        );

        if (!content)
          return { success: false as const, reason: "content_not_found" };

        const track = await chatToolsRepository.findActiveMusicTrackById(
          musicTrackId,
        );

        if (!track)
          return { success: false as const, reason: "track_not_found" };

        await chatToolsRepository.deleteBackgroundMusicLinks(contentId);

        await chatToolsRepository.insertBackgroundMusicLink(
          contentId,
          track.assetId,
        );

        const { refreshEditorTimeline } = await import(
          "../routes/editor/services/refresh-editor-timeline"
        );
        await refreshEditorTimeline(contentId, context.auth.user.id).catch(
          (err) =>
            debugLog.warn("refreshEditorTimeline (attach_music tool) failed", {
              err,
              contentId,
            }),
        );

        debugLog.info("[tool:attach_music] Music attached", {
          service: "chat-tools",
          operation: "attach_music",
          contentId,
          musicTrackId,
        });

        return {
          success: true as const,
          trackName: track.name,
          artistName: track.artistName ?? null,
        };
      } catch (err) {
        debugLog.error("[tool:attach_music] Failed", {
          service: "chat-tools",
          operation: "attach_music",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

// ─── Video Tools ─────────────────────────────────────────────────────────────

export function createGenerateVideoReelTool(context: ToolContext) {
  return tool({
    description:
      "Kick off full video reel generation from an existing draft. Creates an async job and returns a jobId immediately — use get_video_job_status to poll progress. Call this when the user says 'generate the video', 'create the reel', 'make the video now', etc. Requires the content to already have a hook or script.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID to generate video for"),
      prompt: z
        .string()
        .optional()
        .describe("Override prompt for video visuals (uses hook by default)"),
      durationSeconds: z
        .number()
        .optional()
        .describe("Target duration in seconds (default: 30)"),
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
      provider: z.enum(["kling-fal", "runway", "image-ken-burns"]).optional(),
    }),
    execute: async ({
      contentId,
      prompt,
      durationSeconds,
      aspectRatio,
      provider,
    }) => {
      try {
        const content = await chatToolsRepository.findContentForVideoPrompt(
          context.auth.user.id,
          contentId,
        );

        if (!content) return { success: false as const, reason: "not_found" };

        const resolvedPrompt =
          prompt?.trim() ||
          content.generatedHook?.trim() ||
          content.prompt?.trim();
        if (!resolvedPrompt)
          return { success: false as const, reason: "no_prompt" };

        const job = await videoJobService.createJob({
          userId: context.auth.user.id,
          generatedContentId: contentId,
          kind: "reel_generate",
          request: {
            prompt: resolvedPrompt,
            durationSeconds,
            aspectRatio,
            provider,
          },
        });

        setTimeout(
          () =>
            void runReelGeneration({
              job,
              prompt: resolvedPrompt,
              durationSeconds,
              aspectRatio,
              provider: provider as VideoProvider | undefined,
            }),
          0,
        );

        debugLog.info("[tool:generate_video_reel] Job created", {
          service: "chat-tools",
          operation: "generate_video_reel",
          jobId: job.id,
          contentId,
        });
        return { success: true as const, jobId: job.id, status: job.status };
      } catch (err) {
        debugLog.error("[tool:generate_video_reel] Failed", {
          service: "chat-tools",
          operation: "generate_video_reel",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

export function createGetVideoJobStatusTool(context: ToolContext) {
  return tool({
    description:
      "Check the status of a video generation job. Returns status (queued/running/completed/failed), progress (shotsCompleted/totalShots), and result if complete. Use this to report progress to the user after calling generate_video_reel or regenerate_video_shot.",
    inputSchema: z.object({
      jobId: z
        .string()
        .describe("The job ID returned by a video generation tool"),
    }),
    execute: async ({ jobId }) => {
      try {
        const job = await videoJobService.getJob(jobId);
        if (!job || job.userId !== context.auth.user.id) {
          return { success: false as const, reason: "not_found" };
        }
        return {
          success: true as const,
          status: job.status,
          progress: job.progress ?? null,
          result: job.result ?? null,
          error: job.error ?? null,
        };
      } catch {
        return { success: false as const, reason: "error" };
      }
    },
  });
}

export function createRegenerateVideoShotTool(context: ToolContext) {
  return tool({
    description:
      "Regenerate a single shot/scene in the storyboard. Use this when the user says a specific shot looks wrong, doesn't match the script, or wants a different visual for a particular scene. Returns a jobId.",
    inputSchema: z.object({
      contentId: z.number().describe("The generatedContent ID"),
      shotIndex: z
        .number()
        .int()
        .min(0)
        .describe("Zero-based index of the shot to regenerate"),
      prompt: z.string().describe("Visual description for the new shot"),
      durationSeconds: z.number().optional(),
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
      provider: z.enum(["kling-fal", "runway", "image-ken-burns"]).optional(),
    }),
    execute: async ({
      contentId,
      shotIndex,
      prompt,
      durationSeconds,
      aspectRatio,
      provider,
    }) => {
      try {
        const content = await chatToolsRepository.findContentIdOnly(
          context.auth.user.id,
          contentId,
        );

        if (!content) return { success: false as const, reason: "not_found" };

        const job = await videoJobService.createJob({
          userId: context.auth.user.id,
          generatedContentId: contentId,
          kind: "shot_regenerate",
          request: {
            shotIndex,
            prompt,
            durationSeconds,
            aspectRatio,
            provider,
          },
        });

        setTimeout(
          () =>
            void runShotRegenerate({
              job,
              shotIndex,
              prompt,
              durationSeconds,
              aspectRatio,
              provider: provider as VideoProvider | undefined,
            }),
          0,
        );

        return { success: true as const, jobId: job.id, status: job.status };
      } catch (err) {
        debugLog.error("[tool:regenerate_video_shot] Failed", {
          service: "chat-tools",
          operation: "regenerate_video_shot",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

export function createRetryVideoJobTool(context: ToolContext) {
  return tool({
    description:
      "Retry a failed video job (generation, shot regeneration, or assembly). Use this when get_video_job_status returns status='failed' and the user wants to try again.",
    inputSchema: z.object({
      jobId: z.string().describe("The failed job ID to retry"),
    }),
    execute: async ({ jobId }) => {
      try {
        const job = await videoJobService.getJob(jobId);
        if (!job || job.userId !== context.auth.user.id)
          return { success: false as const, reason: "not_found" };
        if (job.status !== "failed")
          return { success: false as const, reason: "job_not_failed" };

        const retryJob = await videoJobService.createJob({
          userId: job.userId,
          generatedContentId: job.generatedContentId,
          kind: job.kind,
          request: job.request,
        });

        setTimeout(() => void getRetryRunner(job, retryJob)(), 0);

        return {
          success: true as const,
          jobId: retryJob.id,
          status: retryJob.status,
        };
      } catch (err) {
        debugLog.error("[tool:retry_video_job] Failed", {
          service: "chat-tools",
          operation: "retry_video_job",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

// ─── Asset Management Tools ──────────────────────────────────────────────────

export function createDeleteVoiceoverTool(context: ToolContext) {
  return tool({
    description:
      "Delete the voiceover audio from a draft. Use when the user says 'remove the voiceover', 'delete the audio', 'start over with the voice'. Also clears the voiceoverUrl field on the content.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID whose voiceover to delete"),
    }),
    execute: async ({ contentId }) => {
      try {
        const link = await chatToolsRepository.findVoiceoverLinkWithR2(
          context.auth.user.id,
          contentId,
        );

        if (!link) return { success: false as const, reason: "no_voiceover" };

        if (link.r2Key) {
          await deleteFile(link.r2Key).catch(() => {});
        }

        await chatToolsRepository.deleteVoiceoverLinkAndAsset(
          contentId,
          link.assetId,
        );

        return { success: true as const };
      } catch (err) {
        debugLog.error("[tool:delete_voiceover] Failed", {
          service: "chat-tools",
          operation: "delete_voiceover",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

export function createRemoveMusicTool(_context: ToolContext) {
  return tool({
    description:
      "Remove the background music from a draft. Use when the user says 'remove the music', 'no background music', 'change the music' (remove first, then search_music + attach_music).",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID whose music to remove"),
    }),
    execute: async ({ contentId }) => {
      try {
        const link = await chatToolsRepository.findBackgroundMusicLink(
          contentId,
        );

        if (!link) return { success: false as const, reason: "no_music" };

        await chatToolsRepository.deleteBackgroundMusicLinkOnly(contentId);

        return { success: true as const };
      } catch (err) {
        debugLog.error("[tool:remove_music] Failed", {
          service: "chat-tools",
          operation: "remove_music",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

// ─── Queue Management Tools ───────────────────────────────────────────────────

export function createRemoveFromQueueTool(context: ToolContext) {
  return tool({
    description:
      "Remove a content item from the queue entirely. Use when the user says 'delete this from the queue', 'remove this', 'I don't want to post this anymore'. Looks up the queue item by content ID.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The generatedContent ID whose queue item to remove"),
    }),
    execute: async ({ contentId }) => {
      try {
        const item = await chatToolsRepository.findQueueItemForUserContent(
          context.auth.user.id,
          contentId,
        );

        if (!item) return { success: false as const, reason: "not_in_queue" };

        await chatToolsRepository.deleteQueueItemById(item.id);
        return { success: true as const };
      } catch (err) {
        debugLog.error("[tool:remove_from_queue] Failed", {
          service: "chat-tools",
          operation: "remove_from_queue",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

export function createScheduleContentTool(context: ToolContext) {
  return tool({
    description:
      "Schedule a queue item to be posted at a specific date and time, or attach an Instagram page. Use when the user says 'schedule this for Tuesday', 'post this at 9am', 'schedule for next week'. The scheduledFor must be a future ISO 8601 datetime string.",
    inputSchema: z.object({
      contentId: z.number().describe("The generatedContent ID to schedule"),
      scheduledFor: z
        .string()
        .describe("ISO 8601 datetime string (must be in the future)"),
      instagramPageId: z
        .string()
        .optional()
        .describe("Instagram page ID to post to"),
    }),
    execute: async ({ contentId, scheduledFor, instagramPageId }) => {
      try {
        const date = new Date(scheduledFor);
        if (isNaN(date.getTime()))
          return { success: false as const, reason: "invalid_date" };
        if (date <= new Date())
          return { success: false as const, reason: "date_in_past" };

        const item = await chatToolsRepository.findQueueItemForSchedule(
          context.auth.user.id,
          contentId,
        );

        if (!item) return { success: false as const, reason: "not_in_queue" };
        if (item.status === "posted")
          return { success: false as const, reason: "already_posted" };

        const updateData: Record<string, unknown> = { scheduledFor: date };
        if (instagramPageId) updateData.instagramPageId = instagramPageId;
        if (item.status === "draft" || item.status === "ready")
          updateData.status = "scheduled";

        await chatToolsRepository.updateQueueItemSchedule(item.id, updateData);

        return { success: true as const, scheduledFor: date.toISOString() };
      } catch (err) {
        debugLog.error("[tool:schedule_content] Failed", {
          service: "chat-tools",
          operation: "schedule_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "error" };
      }
    },
  });
}

// ─── Trending Audio Tool ──────────────────────────────────────────────────────

export function createGetTrendingAudioTool(_context: ToolContext) {
  return tool({
    description:
      "Fetch trending audio tracks currently being used in reels. Use this when the user asks 'what music is trending?', 'what audio should I use?', 'what sounds are popular right now?'. Returns track names, artists, use counts, and trend direction.",
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(90)
        .default(7)
        .describe("Lookback window in days"),
      limit: z.number().int().min(1).max(20).default(10),
    }),
    execute: async ({ days, limit }) => {
      try {
        const trending = await chatToolsRepository.aggregateTrendingAudio(
          days,
          limit,
        );

        return {
          tracks: trending.map((t) => ({
            audioName: t.audioName,
            artistName: null as string | null,
            useCount: t.useCount,
          })),
        };
      } catch (err) {
        debugLog.error("[tool:get_trending_audio] Failed", {
          service: "chat-tools",
          operation: "get_trending_audio",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { tracks: [] };
      }
    },
  });
}

export function createGenerateImageTool(context: ToolContext) {
  return tool({
    description:
      "Generate an image using an AI image model and save it to the user's media library. Use when the user asks to create, generate, or visualize an image (e.g. thumbnails, cover art, scene illustrations). Returns the saved media item. Prefer DALL-E 3 (requires OpenAI key); falls back to Flux via fal.ai.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .max(1000)
        .describe("Detailed description of the image to generate"),
      size: z
        .enum(["square", "portrait", "landscape"])
        .default("portrait")
        .describe(
          "Image dimensions: square (1:1), portrait (9:16), landscape (16:9)",
        ),
      quality: z
        .enum(["standard", "hd"])
        .default("standard")
        .describe("Image quality — hd is slower and costs more"),
    }),
    execute: async ({ prompt, size, quality }) => {
      const sizeMap: Record<string, string> = {
        square: "1024x1024",
        portrait: "1024x1792",
        landscape: "1792x1024",
      };
      const dalleSize = sizeMap[size];

      try {
        let imageBuffer: Buffer;
        let provider: string;

        if (OPENAI_API_KEY) {
          // ── DALL-E 3 via OpenAI ──────────────────────────────────────────
          const res = await fetch(
            "https://api.openai.com/v1/images/generations",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt,
                n: 1,
                size: dalleSize,
                quality,
                response_format: "url",
              }),
            },
          );

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`DALL-E 3 failed (${res.status}): ${body}`);
          }

          const data = (await res.json()) as {
            data: Array<{ url: string; revised_prompt?: string }>;
          };
          const imageUrl = data.data[0]?.url;
          if (!imageUrl) throw new Error("No image URL returned");

          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error("Failed to download generated image");
          imageBuffer = Buffer.from(await imgRes.arrayBuffer());
          provider = "dall-e-3";
        } else if (FAL_API_KEY) {
          // ── FLUX.1-schnell via fal.ai ────────────────────────────────────
          const falSizeMap: Record<string, string> = {
            square: "square_hd",
            portrait: "portrait_16_9",
            landscape: "landscape_16_9",
          };

          const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
              Authorization: `Key ${FAL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
              image_size: falSizeMap[size],
              num_images: 1,
              num_inference_steps: quality === "hd" ? 8 : 4,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`fal.ai Flux failed (${res.status}): ${body}`);
          }

          const data = (await res.json()) as {
            images: Array<{ url: string; content_type: string }>;
          };
          const imageUrl = data.images[0]?.url;
          if (!imageUrl) throw new Error("No image URL returned from fal.ai");

          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error("Failed to download generated image");
          imageBuffer = Buffer.from(await imgRes.arrayBuffer());
          provider = "flux-schnell";
        } else {
          return {
            success: false as const,
            reason: "no_image_provider",
            message:
              "No image generation API key configured (OPENAI_API_KEY or FAL_API_KEY required)",
          };
        }

        const itemId = crypto.randomUUID();
        const r2Key = `media/generated/${context.auth.user.id}/${itemId}.png`;
        const r2Url = await uploadFile(imageBuffer, r2Key, "image/png");

        const name = prompt.slice(0, 60) + (prompt.length > 60 ? "…" : "");

        const item = await chatToolsRepository.insertGeneratedImageAsset({
          id: itemId,
          userId: context.auth.user.id,
          name,
          r2Key,
          r2Url,
          sizeBytes: imageBuffer.length,
          metadata: { provider, prompt, size, quality },
        });

        debugLog.info("[tool:generate_image] Image generated and saved", {
          service: "chat-tools",
          operation: "generate_image",
          itemId: item.id,
          provider,
          size,
          userId: context.auth.user.id,
        });

        return {
          success: true as const,
          itemId: item.id,
          r2Url,
          provider,
          message: "Image generated and saved to your media library.",
        };
      } catch (err) {
        debugLog.error("[tool:generate_image] Failed", {
          service: "chat-tools",
          operation: "generate_image",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "generation_error" };
      }
    },
  });
}

export function createChatTools(context: ToolContext) {
  return {
    // Content
    save_content: createSaveContentTool(context),
    get_reel_analysis: createGetReelAnalysisTool(context),
    get_content: createGetContentTool(context),
    edit_content_field: createEditContentFieldTool(context),
    iterate_content: createIterateContentTool(context),
    update_content_status: createUpdateContentStatusTool(context),
    search_content: createSearchContentTool(context),
    // Voiceover
    list_voices: createListVoicesTool(context),
    generate_voiceover: createGenerateVoiceoverTool(context),
    delete_voiceover: createDeleteVoiceoverTool(context),
    // Music
    search_music: createSearchMusicTool(context),
    attach_music: createAttachMusicTool(context),
    remove_music: createRemoveMusicTool(context),
    get_trending_audio: createGetTrendingAudioTool(context),
    // Video
    generate_video_reel: createGenerateVideoReelTool(context),
    get_video_job_status: createGetVideoJobStatusTool(context),
    regenerate_video_shot: createRegenerateVideoShotTool(context),
    retry_video_job: createRetryVideoJobTool(context),
    // Image generation
    generate_image: createGenerateImageTool(context),
    // Queue
    remove_from_queue: createRemoveFromQueueTool(context),
    schedule_content: createScheduleContentTool(context),
  };
}
