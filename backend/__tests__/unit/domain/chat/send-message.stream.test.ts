import { describe, expect, test } from "bun:test";
import {
  composeChatRequest,
  resolveEffectiveActiveContentId,
} from "@/domain/chat/send-message.helpers";

describe("resolveEffectiveActiveContentId", () => {
  test("prefers request active id over session active id", () => {
    expect(
      resolveEffectiveActiveContentId({
        requestActiveContentId: 42,
        sessionActiveContentId: 12,
      }),
    ).toBe(42);
  });

  test("falls back to session active id when request omits it", () => {
    expect(
      resolveEffectiveActiveContentId({
        sessionActiveContentId: 12,
      }),
    ).toBe(12);
  });
});

describe("composeChatRequest", () => {
  test("puts context in system and leaves the final user message raw", () => {
    const result = composeChatRequest({
      baseSystemPrompt: "Base prompt",
      history: [{ role: "assistant", content: "Earlier reply" }],
      userContent: "make it punchier",
      projectAndAttachmentContext: "Project: My Project",
      sessionDraftInventoryContext: "Session drafts:\n- contentId 12 [ACTIVE]",
      activeContentContext: "Active draft:\nid: 12",
    });

    expect(result.system).toContain("Base prompt");
    expect(result.system).toContain("Session drafts:");
    expect(result.system).toContain("Active draft:");
    expect(result.system).not.toContain("User message:");
    expect(result.messages[result.messages.length - 1]).toEqual({
      role: "user",
      content: "make it punchier",
    });
  });
});
