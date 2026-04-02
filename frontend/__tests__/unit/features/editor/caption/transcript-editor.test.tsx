/// <reference lib="dom" />
import { afterEach, describe, expect, test, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaptionTranscriptEditor } from "@/features/editor/caption/components/CaptionTranscriptEditor";

afterEach(() => {
  cleanup();
});

describe("CaptionTranscriptEditor", () => {
  test("renders existing transcript text and saves updates", () => {
    const onSave = mock();

    render(
      <CaptionTranscriptEditor
        doc={{
          captionDocId: "cap-1",
          fullText: "Hello world",
          language: "en",
          source: "manual",
          tokens: [{ text: "Hello", startMs: 0, endMs: 400 }],
        }}
        onSave={onSave}
      />,
    );

    const textarea = screen.getByPlaceholderText("Edit transcript text");
    fireEvent.change(textarea, { target: { value: "Updated transcript" } });
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith({
      fullText: "Updated transcript",
      language: "en",
      tokens: [{ text: "Hello", startMs: 0, endMs: 400 }],
    });
  });
});
