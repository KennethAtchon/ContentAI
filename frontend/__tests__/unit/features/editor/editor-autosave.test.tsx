import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Track } from "@/features/editor/types/editor";

const patchEditorProject = mock(async () => ({ version: 2 }));
const invalidateEditorProjectsQueries = mock(async () => undefined);

mock.module("@/features/editor/services/editor-api", () => ({
  patchEditorProject,
}));

mock.module("@/shared/lib/query-invalidation", () => ({
  invalidateEditorProjectsQueries,
}));

const { useEditorAutosave } = await import(
  "@/features/editor/hooks/useEditorAutosave"
);

afterEach(() => {
  cleanup();
  patchEditorProject.mockClear();
  invalidateEditorProjectsQueries.mockClear();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useEditorAutosave", () => {
  test("saveService.flushNow persists the latest stripped editor snapshot", async () => {
    const tracks: Track[] = [
      {
        id: "video",
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        transitions: [],
        clips: [
          {
            id: "clip-1",
            type: "video",
            label: "Clip",
            enabled: true,
            locallyModified: true,
            startMs: 0,
            durationMs: 1000,
            trimStartMs: 0,
            trimEndMs: 0,
            assetId: "asset-1",
            volume: 1,
            muted: false,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
          },
        ],
      },
    ];

    const { result } = renderHook(
      () =>
        useEditorAutosave({
          projectId: "project-1",
          isReadOnly: false,
          tracks,
          durationMs: 1000,
          title: "Cut One",
          resolution: "1080x1920",
          fps: 30,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.saveService.flushNow();

    expect(patchEditorProject).toHaveBeenCalledWith("project-1", {
      tracks: [
        {
          id: "video",
          type: "video",
          name: "Video",
          muted: false,
          locked: false,
          transitions: [],
          clips: [
            expect.not.objectContaining({
              locallyModified: true,
            }),
          ],
        },
      ],
      durationMs: 1000,
      title: "Cut One",
      resolution: "1080x1920",
      fps: 30,
    });
  });
});
