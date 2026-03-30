import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { Errors } from "../../utils/errors/app-error";
import { adminService } from "../../domain/singletons";
import {
  adminCreateNicheBodySchema,
  adminNicheIdParamSchema,
  adminNicheReelsQuerySchema,
  adminNichesQuerySchema,
  adminUpdateNicheBodySchema,
  adminUpdateNicheConfigBodySchema,
} from "../../domain/admin/admin.schemas";

const nichesRouter = new Hono<HonoEnv>();

// ─── GET /api/admin/niches ────────────────────────────────────────────────────

nichesRouter.get(
  "/niches",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminNichesQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { search, active } = c.req.valid("query");
    const result = await adminService.listNiches(search, active);
    return c.json(result);
  },
);

// ─── POST /api/admin/niches ───────────────────────────────────────────────────

nichesRouter.post(
  "/niches",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminCreateNicheBodySchema, zodValidationErrorHook),
  async (c) => {
    const { name, description } = c.req.valid("json");
    const result = await adminService.createNiche({ name, description });
    return c.json(result, 201);
  },
);

// ─── PUT /api/admin/niches/:id ────────────────────────────────────────────────

nichesRouter.put(
  "/niches/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  zValidator("json", adminUpdateNicheBodySchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const updates: { name?: string; description?: string; isActive?: boolean } = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      throw Errors.badRequest("No fields to update");
    }

    const result = await adminService.updateNiche(Number(id), updates);
    return c.json(result);
  },
);

// ─── PATCH /api/admin/niches/:id/config ───────────────────────────────────────

nichesRouter.patch(
  "/niches/:id/config",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  zValidator("json", adminUpdateNicheConfigBodySchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const config = c.req.valid("json");

    const result = await adminService.updateNicheConfig(Number(id), config);
    return c.json(result);
  },
);

// ─── DELETE /api/admin/niches/:id ─────────────────────────────────────────────

nichesRouter.delete(
  "/niches/:id",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await adminService.deleteNiche(Number(id));
    return c.json(result);
  },
);

// ─── GET /api/admin/niches/:id/reels ──────────────────────────────────────────

nichesRouter.get(
  "/niches/:id/reels",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  zValidator("query", adminNicheReelsQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const { page, limit, sortBy, sortOrder, viral, hasVideo } = c.req.valid("query");

    // Verify niche exists
    const niche = await adminService.listNiches();
    if (!niche.niches.find((n) => n.id === Number(id))) {
      throw Errors.notFound("Niche");
    }

    const result = await adminService.getNicheReels(Number(id), {
      page,
      limit,
      sortBy,
      sortOrder,
      viral,
      hasVideo,
    });

    return c.json(result);
  },
);

// ─── POST /api/admin/niches/:id/dedupe ───────────────────────────────────────
// Find and hard-delete duplicate reels within this niche (by externalId).

nichesRouter.post(
  "/niches/:id/dedupe",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");

    // Verify niche exists
    const niche = await adminService.listNiches();
    if (!niche.niches.find((n) => n.id === id)) {
      throw Errors.notFound("Niche");
    }

    const result = await adminService.dedupeNicheReels(Number(id));
    return c.json(result);
  },
);

// ─── POST /api/admin/niches/:id/scan ─────────────────────────────────────────
// Trigger a reel scraping job for this niche.

nichesRouter.post(
  "/niches/:id/scan",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("param", adminNicheIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await adminService.triggerNicheScrapeJob(Number(id));
    return c.json(result, 201);
  },
);

export default nichesRouter;
