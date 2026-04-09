import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  captionDocIdParamSchema,
  manualCaptionDocSchema,
  transcribeCaptionsSchema,
  patchCaptionDocSchema,
} from "@/domain/editor/editor.schemas";
import { zodValidationErrorHook } from "@/validation/zod-validation-hook";

const captionsService = {
  transcribeAsset: mock(async () => ({
    captionDocId: "cap-123",
    tokens: [{ text: "hello", startMs: 0, endMs: 500 }],
    fullText: "hello",
  })),
  createManual: mock(async () => ({ captionDocId: "cap-manual" })),
  updateCaptionDoc: mock(async () => ({
    captionDocId: "cap-123",
    updatedAt: "2026-04-01T00:00:00.000Z",
  })),
};

function buildApp() {
  const app = new Hono();

  app.post(
    "/api/captions/transcribe",
    zValidator("json", transcribeCaptionsSchema, zodValidationErrorHook),
    async (c) => {
      const { assetId, force } = c.req.valid("json");
      return c.json(
        await captionsService.transcribeAsset("user-1", assetId, { force }),
      );
    },
  );

  app.post(
    "/api/captions/manual",
    zValidator("json", manualCaptionDocSchema, zodValidationErrorHook),
    async (c) =>
      c.json(
        await captionsService.createManual("user-1", c.req.valid("json")),
        201,
      ),
  );

  app.patch(
    "/api/captions/doc/:captionDocId",
    zValidator("param", captionDocIdParamSchema, zodValidationErrorHook),
    zValidator("json", patchCaptionDocSchema, zodValidationErrorHook),
    async (c) => {
      const { captionDocId } = c.req.valid("param");
      return c.json(
        await captionsService.updateCaptionDoc(
          "user-1",
          captionDocId,
          c.req.valid("json"),
        ),
      );
    },
  );

  return app;
}

describe("editor captions routes", () => {
  it("POST /api/captions/transcribe returns captionDocId and forwards force", async () => {
    const app = buildApp();
    const res = await app.request("/api/captions/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: "asset-1", force: true }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      captionDocId: "cap-123",
      tokens: [{ text: "hello", startMs: 0, endMs: 500 }],
      fullText: "hello",
    });
    expect(captionsService.transcribeAsset).toHaveBeenCalledWith(
      "user-1",
      "asset-1",
      { force: true },
    );
  });

  it("POST /api/captions/manual returns captionDocId", async () => {
    const app = buildApp();
    const res = await app.request("/api/captions/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: null,
        fullText: "hello world",
        language: "en",
        tokens: [
          { text: "hello", startMs: 0, endMs: 500 },
          { text: "world", startMs: 500, endMs: 1000 },
        ],
      }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ captionDocId: "cap-manual" });
  });

  it("PATCH /api/captions/doc/:captionDocId returns captionDocId", async () => {
    const app = buildApp();
    const res = await app.request("/api/captions/doc/cap-123", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullText: "hello world",
        language: "en",
        tokens: [
          { text: "hello", startMs: 0, endMs: 500 },
          { text: "world", startMs: 500, endMs: 1000 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      captionDocId: "cap-123",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
  });
});
