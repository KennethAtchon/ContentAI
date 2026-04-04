import { describe, expect, test } from "bun:test";
import type { IChatRepository } from "@/domain/chat/chat.repository";
import {
  ChatService,
  buildActiveDraftSection,
  buildSessionDraftInventorySection,
  truncateContextField,
} from "@/domain/chat/chat.service";

describe("chat context formatting", () => {
  test("session draft inventory includes active marker and compact summaries", () => {
    const output = buildSessionDraftInventorySection(
      [
        {
          id: 12,
          version: 2,
          outputType: "full_script",
          status: "draft",
          generatedHook: "A hook worth keeping around for context inventory",
          createdAt: new Date("2026-04-04T00:00:00.000Z"),
        },
        {
          id: 14,
          version: 1,
          outputType: "hook_only",
          status: "queued",
          generatedHook: "Another draft hook",
          createdAt: new Date("2026-04-04T00:01:00.000Z"),
        },
      ],
      14,
    );

    expect(output).toContain("Session drafts:");
    expect(output).toContain("contentId 14 [ACTIVE]");
    expect(output).toContain("version 1");
    expect(output).toContain('hook "Another draft hook"');
  });

  test("active draft section includes voiceoverScript and truncates oversized fields with content id marker", () => {
    const output = buildActiveDraftSection({
      id: 123,
      prompt: "Prompt",
      version: 4,
      outputType: "full_script",
      status: "draft",
      generatedHook: "Hook",
      postCaption: "Caption",
      generatedScript: "x".repeat(1500),
      voiceoverScript: "Voiceover stays in the active draft context",
      sceneDescription: "Scene",
      generatedMetadata: { hashtags: ["one", "two"], cta: "save this" },
      parentId: 122,
      sourceReelId: 77,
    });

    expect(output).toContain("voiceoverScript:");
    expect(output).toContain("Voiceover stays in the active draft context");
    expect(output).toContain(
      "[truncated; call get_content with contentId 123 for the full record]",
    );
    expect(output).toContain("sourceReelId: 77");
  });

  test("truncateContextField leaves short values alone and truncates long values", () => {
    expect(truncateContextField("short", 20, 99)).toBe("short");
    expect(truncateContextField("a".repeat(25), 10, 99)).toContain(
      "contentId 99",
    );
  });
});

describe("session-scoped active draft lookup", () => {
  test("findActiveDraftForSessionContext returns the attached draft only", async () => {
    const repo = {
      listSessionContentIds: async () => [7, 8],
      findContentForChatContext: async (contentId: number) => ({
        id: contentId,
        prompt: "Prompt",
        version: 1,
        outputType: "full_script",
        status: "draft",
        generatedHook: "Hook",
        postCaption: "Caption",
        generatedScript: "Script",
        voiceoverScript: "Voiceover",
        sceneDescription: "Scene",
        generatedMetadata: null,
        parentId: null,
        sourceReelId: null,
      }),
    } as unknown as IChatRepository;

    const service = new ChatService(repo);

    const attached = await service.findActiveDraftForSessionContext(
      "session-1",
      "user-1",
      8,
    );
    const detached = await service.findActiveDraftForSessionContext(
      "session-1",
      "user-1",
      999,
    );

    expect(attached?.id).toBe(8);
    expect(detached).toBeUndefined();
  });
});
