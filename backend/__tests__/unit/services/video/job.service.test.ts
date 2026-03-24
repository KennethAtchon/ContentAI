import { beforeEach, describe, expect, test } from "bun:test";
import { videoJobService } from "@/services/video/job.service";

const testMocks = (global as any).__testMocks__ as {
  redisTestStore: Map<string, string>;
  redisTestMocks: {
    set: { mock: { calls: unknown[][] } };
    get: { mock: { calls: unknown[][] } };
  };
};

describe("video job service", () => {
  beforeEach(() => {
    testMocks.redisTestStore.clear();
    testMocks.redisTestMocks.set.mockClear();
    testMocks.redisTestMocks.get.mockClear();
  });

  test("createJob persists queued job with request metadata", async () => {
    const created = await videoJobService.createJob({
      userId: "user-1",
      generatedContentId: 42,
      kind: "reel_generate",
      request: { includeCaptions: true },
    });

    expect(created.id.startsWith("video_")).toBe(true);
    expect(created.status).toBe("queued");
    expect(created.request).toEqual({ includeCaptions: true });

    const fetched = await videoJobService.getJob(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.generatedContentId).toBe(42);
    expect(fetched?.kind).toBe("reel_generate");

    const [, , mode, ttl] = testMocks.redisTestMocks.set.mock.calls[0] ?? [];
    expect(mode).toBe("EX");
    expect(ttl).toBe(60 * 60 * 24);
  });

  test("updateJob merges patch but preserves immutable identity fields", async () => {
    const created = await videoJobService.createJob({
      userId: "user-2",
      generatedContentId: 99,
      kind: "assemble",
    });

    const updated = await videoJobService.updateJob(created.id, {
      status: "running",
      id: "attempted-overwrite",
      userId: "other-user",
      generatedContentId: 1,
      kind: "shot_regenerate",
      startedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(updated?.id).toBe(created.id);
    expect(updated?.userId).toBe("user-2");
    expect(updated?.generatedContentId).toBe(99);
    expect(updated?.kind).toBe("assemble");
    expect(updated?.status).toBe("running");
    expect(updated?.startedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  test("updateJob returns null for missing job", async () => {
    const updated = await videoJobService.updateJob("missing-job", {
      status: "failed",
    });
    expect(updated).toBeNull();
  });

  test("getJob returns null for malformed payload", async () => {
    testMocks.redisTestStore.set("video_job:bad-json", "{broken");
    const job = await videoJobService.getJob("bad-json");
    expect(job).toBeNull();
  });
});
