import { describe, expect, it } from "bun:test";
import { getSessionDraftLabel } from "@/domains/chat/lib/draft-labels";
import type { SessionDraft } from "@/domains/chat/model/chat.types";

function makeDraft(overrides?: Partial<SessionDraft>): SessionDraft {
  return {
    id: 1,
    version: 1,
    outputType: "full_script",
    status: "completed",
    generatedHook: null,
    generatedScript: null,
    voiceoverScript: null,
    postCaption: null,
    sceneDescription: null,
    generatedMetadata: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("draft-labels", () => {
  it("falls back to a numbered draft label when no hook exists", () => {
    const t = ((key: string, options?: { index?: number }) =>
      key === "workspace_draft_untitled"
        ? `Draft ${options?.index}`
        : key) as never;

    expect(getSessionDraftLabel(makeDraft(), 2, t)).toBe("Draft 3");
  });

  it("truncates long hooks with an ellipsis", () => {
    const t = ((key: string) => key) as never;

    expect(
      getSessionDraftLabel(
        makeDraft({
          generatedHook:
            "This hook is intentionally much longer than the label budget so it should truncate cleanly",
        }),
        0,
        t,
        { maxLength: 24 }
      )
    ).toBe("This hook is intentiona…");
  });
});
