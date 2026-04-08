import { describe, expect, test } from "bun:test";
import { SyncService } from "../../../../src/domain/editor/sync/sync.service";
import type { TimelineTrackJson } from "../../../../src/domain/editor/timeline/merge-placeholders-with-assets";

function emptyTracks(): TimelineTrackJson[] {
  return [
    {
      id: "video-track",
      type: "video",
      name: "Video",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
    {
      id: "audio-track",
      type: "audio",
      name: "Voiceover",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
    {
      id: "music-track",
      type: "music",
      name: "Music",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
    {
      id: "text-track",
      type: "text",
      name: "Text",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
  ];
}

describe("SyncService.syncLinkedProjects", () => {
  test("adds a caption clip when a linked project gains a voiceover", async () => {
    const updates: Array<{
      projectId: string;
      userId: string;
      data: { tracks: unknown; durationMs: number; generatedContentId: number };
    }> = [];

    const editorRepo = {
      findProjectsByContentIds: async () => [
        {
          id: "project-1",
          tracks: emptyTracks(),
          durationMs: 0,
        },
      ],
      updateProjectForSync: async (
        projectId: string,
        userId: string,
        data: { tracks: unknown; durationMs: number; generatedContentId: number },
      ) => {
        updates.push({ projectId, userId, data });
      },
    } as any;

    const contentRepo = {
      resolveContentAncestorChainIds: async () => [42],
      listAssetsLinkedToGeneratedContent: async () => [
        {
          id: "voiceover-asset",
          role: "voiceover",
          durationMs: 3200,
          metadata: {},
        },
      ],
    } as any;

    const captionsService = {
      transcribeAsset: async (userId: string, assetId: string) => {
        expect(userId).toBe("user-1");
        expect(assetId).toBe("voiceover-asset");
        return { captionDocId: "caption-doc-1" };
      },
    } as any;

    const service = new SyncService(editorRepo, contentRepo, captionsService);

    await service.syncLinkedProjects("user-1", 42);

    expect(updates).toHaveLength(1);
    const [{ data }] = updates;
    const tracks = data.tracks as TimelineTrackJson[];
    const audioTrack = tracks.find((track) => track.type === "audio");
    const textTrack = tracks.find((track) => track.type === "text");

    expect(data.generatedContentId).toBe(42);
    expect(data.durationMs).toBe(3200);
    expect(audioTrack?.clips).toHaveLength(1);
    expect(audioTrack?.clips[0]?.assetId).toBe("voiceover-asset");
    expect(textTrack?.clips).toHaveLength(1);
    expect(textTrack?.clips[0]).toMatchObject({
      type: "caption",
      captionDocId: "caption-doc-1",
      durationMs: 3200,
      sourceStartMs: 0,
      sourceEndMs: 3200,
      stylePresetId: "hormozi",
    });
  });
});
