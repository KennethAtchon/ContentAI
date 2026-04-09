import { describe, expect, mock, test } from "bun:test";
import type { Track } from "@/types/timeline.types";

process.env.FIREBASE_API_KEY = process.env.FIREBASE_API_KEY ?? "test-api-key";
process.env.FIREBASE_AUTH_DOMAIN =
  process.env.FIREBASE_AUTH_DOMAIN ?? "test.firebaseapp.com";
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ?? "test-project";
process.env.FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? "test-bucket";
process.env.FIREBASE_MESSAGING_SENDER_ID =
  process.env.FIREBASE_MESSAGING_SENDER_ID ?? "123456789";
process.env.FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID ?? "1:123456789:web:test";
process.env.FIREBASE_CLIENT_EMAIL =
  process.env.FIREBASE_CLIENT_EMAIL ?? "test@example.com";
process.env.FIREBASE_PRIVATE_KEY =
  process.env.FIREBASE_PRIVATE_KEY ??
  "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? "test-csrf-secret";

mock.module("@/services/storage/r2", () => ({
  getFileUrl: mock(async () => "https://example.com/video.mp4"),
  uploadFile: mock(async () => "https://example.com/output.mp4"),
}));

const updateExportJob = mock(async () => {});
const fetchMock = mock(
  async () =>
    new Response(new Uint8Array([0, 1, 2]).buffer, {
      status: 200,
      headers: { "content-type": "video/mp4" },
    }),
);

globalThis.fetch = fetchMock as typeof fetch;

function makeProject(tracks: Track[]) {
  return {
    id: "project-1",
    tracks,
    durationMs: 2_000,
    fps: 30,
    resolution: "1080x1920",
  };
}

describe("runExportJob", () => {
  test("fails the export when a caption clip references a missing caption doc", async () => {
    const { runExportJob } = await import("@/domain/editor/run-export-job");
    updateExportJob.mockClear();
    fetchMock.mockClear();

    await runExportJob(
      "job-1",
      makeProject([
        {
          id: "video",
          type: "video",
          name: "Video",
          muted: false,
          locked: false,
          transitions: [],
          clips: [
            {
              id: "video-1",
              type: "video",
              label: "Clip",
              startMs: 0,
              durationMs: 2_000,
              assetId: "asset-1",
              trimStartMs: 0,
              trimEndMs: 0,
              speed: 1,
              enabled: true,
              opacity: 1,
              warmth: 0,
              contrast: 0,
              positionX: 0,
              positionY: 0,
              scale: 1,
              rotation: 0,
              volume: 1,
              muted: false,
            },
          ],
        },
        {
          id: "audio",
          type: "audio",
          name: "Audio",
          muted: false,
          locked: false,
          transitions: [],
          clips: [],
        },
        {
          id: "music",
          type: "music",
          name: "Music",
          muted: false,
          locked: false,
          transitions: [],
          clips: [],
        },
        {
          id: "text",
          type: "text",
          name: "Text",
          muted: false,
          locked: false,
          transitions: [],
          clips: [
            {
              id: "caption-1",
              type: "caption",
              startMs: 0,
              durationMs: 2_000,
              originVoiceoverClipId: null,
              captionDocId: "missing-doc",
              sourceStartMs: 0,
              sourceEndMs: 2_000,
              stylePresetId: "clean-minimal",
              styleOverrides: {},
              groupingMs: 1400,
            },
          ],
        },
      ]),
      "user-1",
      {},
      {
        updateExportJob,
        findManyAssetsByIdsForUser: async () => [
          { id: "asset-1", r2Key: "video.mp4", type: "video" },
        ],
        findCaptionDocByIdForUser: async () => null,
        getCaptionPreset: async () => null,
        insertAssembledVideoAsset: async () => ({ id: "out-1" }),
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(updateExportJob.mock.calls.at(-1)).toEqual([
      "job-1",
      {
        status: "failed",
        error: expect.stringContaining(
          'Caption doc "missing-doc" was not found',
        ),
      },
    ]);
  });
});
