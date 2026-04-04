export function resolveEffectiveActiveContentId(input: {
  requestActiveContentId?: number;
  sessionActiveContentId?: number | null;
}): number | undefined {
  return (
    input.requestActiveContentId ?? input.sessionActiveContentId ?? undefined
  );
}

export function composeChatRequest(input: {
  baseSystemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userContent: string;
  projectAndAttachmentContext?: string;
  sessionDraftInventoryContext?: string;
  activeContentContext?: string;
}) {
  const system = [
    input.baseSystemPrompt,
    input.projectAndAttachmentContext,
    input.sessionDraftInventoryContext,
    input.activeContentContext,
  ]
    .filter((section) => Boolean(section && section.trim().length > 0))
    .join("\n\n");

  return {
    system,
    messages: [
      ...input.history,
      { role: "user" as const, content: input.userContent },
    ],
  };
}
