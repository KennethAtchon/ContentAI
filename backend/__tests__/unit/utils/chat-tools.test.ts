import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSaveContentTool } from "@/lib/chat-tools";
import { z } from "zod";

// Mock the database
vi.mock("@/services/db/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
  },
}));

// Mock debug log
vi.mock("@/utils/debug/debug", () => ({
  debugLog: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("createSaveContentTool", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      auth: { user: { id: "test-user-id" } },
      content: "test prompt",
      savedContentId: undefined,
    };
  });

  it("should accept cleanScript parameter in input schema", () => {
    const tool = createSaveContentTool(mockContext);
    const schema = tool.inputSchema;

    // Test that the schema accepts cleanScript
    const validInput = {
      hook: "Amazing hook that stops the scroll",
      script: "[0-3s] Opening hook with visual\n[3-8s] Problem setup\n[8-15s] Solution demonstration",
      cleanScript: "Amazing hook that stops the scroll. Here's the problem setup, and now let me show you the solution demonstration.",
      caption: "Amazing caption with emojis 🔥",
      hashtags: ["viral", "trending", "fyp"],
      cta: "Follow for more!",
      contentType: "full_script" as const,
    };

    expect(() => schema.parse(validInput)).not.toThrow();
  });

  it("should require cleanScript to be at least 30 characters", () => {
    const tool = createSaveContentTool(mockContext);
    const schema = tool.inputSchema;

    const invalidInput = {
      hook: "Amazing hook that stops the scroll",
      script: "[0-3s] Opening hook with visual",
      cleanScript: "Too short",
      caption: "Amazing caption with emojis 🔥",
      hashtags: ["viral", "trending"],
      cta: "Follow for more!",
      contentType: "full_script" as const,
    };

    expect(() => schema.parse(invalidInput)).toThrow();
  });

  it("should pass cleanScript to database insertion", async () => {
    const { db } = await import("@/services/db/db");
    const tool = createSaveContentTool(mockContext);

    const input = {
      hook: "Test hook",
      script: "[0-3s] Test script with timestamps",
      cleanScript: "Test script without timestamps for clean audio",
      caption: "Test caption",
      hashtags: ["test"],
      cta: "Test CTA",
      contentType: "full_script" as const,
    };

    await tool.execute(input);

    // Verify db.insert was called with cleanScriptForAudio
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          cleanScriptForAudio: "Test script without timestamps for clean audio",
        }),
      })
    );
  });
});