import { describe, it, expect, beforeEach } from "bun:test";
import { createSaveContentTool } from "@/lib/chat-tools";

describe("createSaveContentTool", () => {
  let mockContext: {
    auth: { user: { id: string } };
    content: string;
    savedContentId?: number;
  };

  beforeEach(() => {
    mockContext = {
      auth: { user: { id: "test-user-id" } },
      content: "test prompt",
      savedContentId: undefined,
    };
  });

  it("accepts voiceoverScript and postCaption in input schema", () => {
    const tool = createSaveContentTool(mockContext);
    const schema = tool.inputSchema;

    const validInput = {
      hook: "Amazing hook that stops the scroll",
      script:
        "[0-3s] Opening hook with visual\n[3-8s] Problem setup\n[8-15s] Solution demonstration",
      voiceoverScript:
        "Amazing hook that stops the scroll. Here's the problem setup, and now let me show you the solution demonstration.",
      sceneDescription:
        "Cinematic handheld footage with warm lighting and close-up product detail.",
      postCaption: "Amazing caption with emojis 🔥",
      hashtags: ["viral", "trending", "fyp"],
      cta: "Follow for more!",
      contentType: "full_script" as const,
    };

    expect(() => schema.parse(validInput)).not.toThrow();
  });

  it("requires voiceoverScript to be at least 30 characters", () => {
    const tool = createSaveContentTool(mockContext);
    const schema = tool.inputSchema;

    const invalidInput = {
      hook: "Amazing hook that stops the scroll",
      script: "[0-3s] Opening hook with visual",
      voiceoverScript: "Too short",
      sceneDescription:
        "Cinematic handheld footage with warm lighting and close-up product detail.",
      postCaption: "Amazing caption with emojis 🔥",
      hashtags: ["viral", "trending"],
      cta: "Follow for more!",
      contentType: "full_script" as const,
    };

    expect(() => schema.parse(invalidInput)).toThrow();
  });
});
