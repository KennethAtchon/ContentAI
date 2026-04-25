import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { handleRouteError } from "@/middleware/error-handler";
import { AppError, Errors } from "@/utils/errors/app-error";

describe("AppError", () => {
  test("toResponseBody preserves details and flattens project conflict metadata", () => {
    const error = new AppError("project_exists", "PROJECT_EXISTS", 409, {
      existingProjectId: "proj_123",
      nested: true,
    });

    expect(error.toResponseBody()).toEqual({
      error: "project_exists",
      code: "PROJECT_EXISTS",
      details: {
        existingProjectId: "proj_123",
        nested: true,
      },
      existingProjectId: "proj_123",
    });
  });

  test("toResponseBody preserves video job metadata for existing consumers", () => {
    const error = new AppError(
      "Video generation already running",
      "VIDEO_JOB_IN_PROGRESS",
      409,
      {
        jobId: "job_123",
        kind: "reel_generate",
      },
    );

    expect(error.toResponseBody()).toEqual({
      error: "Video generation already running",
      code: "VIDEO_JOB_IN_PROGRESS",
      details: {
        jobId: "job_123",
        kind: "reel_generate",
      },
      jobId: "job_123",
      kind: "reel_generate",
    });
  });
});

describe("handleRouteError", () => {
  test("serializes AppError responses via the centralized AppError formatter", async () => {
    const app = new Hono();
    app.onError(handleRouteError);
    app.get("/project-conflict", () => {
      throw new AppError("project_exists", "PROJECT_EXISTS", 409, {
        existingProjectId: "proj_123",
      });
    });

    const res = await app.request("/project-conflict");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "project_exists",
      code: "PROJECT_EXISTS",
      details: {
        existingProjectId: "proj_123",
      },
      existingProjectId: "proj_123",
    });
  });

  test("returns service unavailable errors without leaking internals", async () => {
    const app = new Hono();
    app.onError(handleRouteError);
    app.get("/usage-gate", () => {
      throw Errors.serviceUnavailable("Unable to verify current usage limit");
    });

    const res = await app.request("/usage-gate");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Unable to verify current usage limit",
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
