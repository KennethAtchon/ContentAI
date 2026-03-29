import { and, eq } from "drizzle-orm";
import { generatedContent } from "../../infrastructure/database/drizzle/schema";
import { db } from "../../services/db/db";

export type VideoRouteOwnedContent = {
  id: number;
  prompt: string | null;
  generatedHook: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  sceneDescription: string | null;
  generatedMetadata: Record<string, unknown> | null;
};

export async function fetchOwnedContent(
  userId: string,
  generatedContentId: number,
): Promise<VideoRouteOwnedContent | null> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      prompt: generatedContent.prompt,
      generatedHook: generatedContent.generatedHook,
      generatedScript: generatedContent.generatedScript,
      voiceoverScript: generatedContent.voiceoverScript,
      sceneDescription: generatedContent.sceneDescription,
      generatedMetadata: generatedContent.generatedMetadata,
    })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, generatedContentId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1);

  if (!content) return null;
  return {
    ...content,
    generatedMetadata:
      (content.generatedMetadata as Record<string, unknown> | null) ?? null,
  };
}

export function getPhase4AssemblyFromMetadata(metadata: unknown): {
  jobId: string;
  status: string;
} | null {
  const root = metadata as Record<string, unknown> | null | undefined;
  const phase4 = root?.phase4 as Record<string, unknown> | undefined;
  const assembly = phase4?.assembly as Record<string, unknown> | undefined;
  if (!assembly) return null;
  const jobId = assembly.jobId;
  const status = assembly.status;
  if (typeof jobId !== "string" || typeof status !== "string") return null;
  return { jobId, status };
}

export async function updatePhase4Metadata(input: {
  generatedContentId: number;
  existingGeneratedMetadata: Record<string, unknown> | null;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  shots?: Array<{
    shotIndex: number;
    description: string;
    durationMs: number;
    assetId: string;
    useClipAudio: boolean;
  }>;
  provider?: string;
}) {
  const existingMetadata = input.existingGeneratedMetadata ?? {};
  const existingPhase4 =
    (existingMetadata.phase4 as Record<string, unknown> | null) ?? {};

  await db
    .update(generatedContent)
    .set({
      generatedMetadata: {
        ...existingMetadata,
        phase4: {
          ...existingPhase4,
          ...(input.shots ? { shots: input.shots } : {}),
          assembly: {
            jobId: input.jobId,
            status: input.status,
            ...(input.provider ? { provider: input.provider } : {}),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    })
    .where(eq(generatedContent.id, input.generatedContentId));
}
