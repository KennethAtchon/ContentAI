/**
 * SSE stream parsing utilities for the chat feature.
 * These are pure functions with no React or hook dependencies.
 */

import { debugLog } from "@/shared/utils/debug/debug";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Tools that persist content — drives the "saving" indicator in the UI.
 */
export const CONTENT_WRITING_TOOLS = new Set([
  "save_content",
  "iterate_content",
  "edit_content_field",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamIngestState = {
  accumulated: string;
  textDeltaCount: number;
};

export type StreamIngestSetters = {
  setStreamingContent: (value: string | null) => void;
  setIsSavingContent: (value: boolean) => void;
  setStreamingContentId: (value: number | null) => void;
  setStreamError: (value: string | null) => void;
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Strips `<tool_call>...</tool_call>` from streamed text so the chat UI stays
 * clean when models emit tool XML as plain text.
 */
export function filterToolCallXml(text: string): string {
  let filtered = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .trimEnd();
  const openIdx = filtered.lastIndexOf("<tool_call>");
  if (openIdx !== -1) {
    filtered = filtered.substring(0, openIdx).trimEnd();
  }
  return filtered;
}

export function parseSseDataPayload(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) return null;
  return trimmed.slice(6);
}

function accumulatedMentionsContentWritingTool(accumulated: string): boolean {
  if (!accumulated.includes("<tool_call>")) return false;
  for (const name of CONTENT_WRITING_TOOLS) {
    if (accumulated.includes(name)) return true;
  }
  return false;
}

export function processStreamSseLine(
  line: string,
  state: StreamIngestState,
  setters: StreamIngestSetters
): void {
  const jsonStr = parseSseDataPayload(line);
  if (jsonStr === null) return;
  if (jsonStr === "[DONE]") {
    debugLog.info("[ChatStream] Received [DONE] signal");
    return;
  }

  try {
    const chunk = JSON.parse(jsonStr) as { type: string; [key: string]: unknown };

    debugLog.debug("[ChatStream] Processed chunk", { chunk });

    switch (chunk.type) {
      case "text-delta": {
        state.textDeltaCount++;
        state.accumulated += (chunk.delta as string) ?? "";
        const displayText = filterToolCallXml(state.accumulated);
        setters.setStreamingContent(displayText || null);
        if (accumulatedMentionsContentWritingTool(state.accumulated)) {
          setters.setIsSavingContent(true);
        }
        if (state.textDeltaCount % 20 === 0) {
          debugLog.debug("[ChatStream] text-delta progress", {
            textDeltaCount: state.textDeltaCount,
            accumulatedLength: state.accumulated.length,
          });
        }
        break;
      }
      case "tool-input-start": {
        debugLog.info("[ChatStream] tool-input-start received", { toolName: chunk.toolName });
        if (CONTENT_WRITING_TOOLS.has(chunk.toolName as string)) {
          setters.setIsSavingContent(true);
        }
        break;
      }
      case "tool-output-available": {
        const output = chunk.output as { contentId?: number; success?: boolean } | null;
        debugLog.info("[ChatStream] tool-output-available received", {
          toolName: chunk.toolName,
          success: output?.success,
          contentId: output?.contentId,
        });
        if (output?.contentId) {
          setters.setStreamingContentId(output.contentId);
        }
        setters.setIsSavingContent(false);
        break;
      }
      case "error": {
        const errorText = (chunk.errorText as string) || "An error occurred";
        debugLog.error("[ChatStream] Error chunk received from server", { errorText });
        setters.setStreamError(errorText);
        break;
      }
      default:
        debugLog.debug("[ChatStream] SSE event", { type: chunk.type });
    }
  } catch {
    // malformed chunk — skip
  }
}

export async function drainSseStreamIntoIngest(
  body: ReadableStream<Uint8Array>,
  ingest: StreamIngestState,
  setters: StreamIngestSetters
): Promise<{ chunkCount: number }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processStreamSseLine(line, ingest, setters);
    }
  }
  if (buffer) processStreamSseLine(buffer, ingest, setters);

  return { chunkCount };
}
