import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  captionDocIdParamSchema,
  manualCaptionDocSchema,
  patchCaptionDocSchema,
} from "@/domain/editor/editor.schemas";
import { zodValidationErrorHook } from "@/validation/zod-validation-hook";

function buildApp() {
  const app = new Hono();

  app.post(
    "/api/captions/manual",
    zValidator("json", manualCaptionDocSchema, zodValidationErrorHook),
    async (c) => c.json({ captionDocId: "cap-manual" }, 201),
  );

  app.patch(
    "/api/captions/doc/:captionDocId",
    zValidator("param", captionDocIdParamSchema, zodValidationErrorHook),
    zValidator("json", patchCaptionDocSchema, zodValidationErrorHook),
    async (c) =>
      c.json({
        captionDocId: c.req.valid("param").captionDocId,
        updatedAt: "2026-04-01T00:00:00.000Z",
      }),
  );

  return app;
}

describe("editor captions language validation", () => {
  it("rejects non-English language on POST /api/captions/manual", async () => {
    const app = buildApp();
    const res = await app.request("/api/captions/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: null,
        fullText: "hola",
        language: "es",
        tokens: [{ text: "hola", startMs: 0, endMs: 500 }],
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(JSON.stringify(body.details)).toContain("en");
  });

  it("rejects non-English language on PATCH /api/captions/doc/:captionDocId", async () => {
    const app = buildApp();
    const res = await app.request("/api/captions/doc/cap-123", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullText: "hola",
        language: "es",
        tokens: [{ text: "hola", startMs: 0, endMs: 500 }],
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(JSON.stringify(body.details)).toContain("en");
  });
});
