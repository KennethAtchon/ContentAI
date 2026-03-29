import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { usersService } from "../../domain/singletons";
import { adminAuth } from "../../services/firebase/admin";
import { FirebaseUserSync } from "../../domain/auth/firebase-user-sync";
import { Errors } from "../../utils/errors/app-error";
import {
  createUserBodySchema,
  deleteUserBodySchema,
  objectToProcessingBodySchema,
  updateUserBodySchema,
  usersListQuerySchema,
} from "../../domain/users/users.schemas";

const users = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

// ─── GET /api/users ───────────────────────────────────────────────────────────

users.get(
  "/",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", usersListQuerySchema, validationErrorHook),
  async (c) => {
    const { page, limit, search, includeDeleted } = c.req.valid("query");

    const result = await usersService.listUsers({
      page,
      limit,
      search,
      includeDeleted,
    });

    return c.json(result);
  },
);

// ─── POST /api/users ──────────────────────────────────────────────────────────

users.post(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", createUserBodySchema, validationErrorHook),
  async (c) => {
    const { name, email, password, createInFirebase, timezone } =
      c.req.valid("json");

    let firebaseUid: string | null = null;

    if (createInFirebase) {
      const syncResult = await FirebaseUserSync.syncUserCreate({
        email,
        name,
        password,
        role: "user",
      });
      if (!syncResult.success) {
        throw Errors.internal(`Failed to create Firebase user: ${syncResult.error}`);
      }
      firebaseUid = syncResult.firebaseUid || null;
    }

    const newUser = await usersService.createUser({
      name,
      email,
      firebaseUid,
      timezone,
    });

    return c.json(newUser, 201);
  },
);

// ─── PATCH /api/users ─────────────────────────────────────────────────────────

users.patch(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", updateUserBodySchema, validationErrorHook),
  async (c) => {
    const {
      id,
      phone,
      address,
      role,
      name,
      password: _password,
      email,
      isActive,
      timezone,
    } = c.req.valid("json");

    const existingUser = await usersService.getUserById(id);

    const updatedUser = await usersService.updateUser(id, {
      phone,
      address,
      role,
      name,
      email,
      isActive,
      timezone,
    });

    if (existingUser.firebaseUid) {
      const syncData: Record<string, unknown> = {};
      if (email !== undefined) syncData.email = email;
      if (name !== undefined) syncData.name = name;
      if (role !== undefined) syncData.role = role;
      if (isActive !== undefined) syncData.isActive = isActive;

      if (Object.keys(syncData).length > 0) {
        await FirebaseUserSync.syncUserUpdate(
          existingUser.firebaseUid,
          syncData as any,
        ).catch(() => {
          // Best-effort Firebase sync - log but don't fail
        });
      }
    }

    return c.json(updatedUser);
  },
);

// ─── DELETE /api/users ────────────────────────────────────────────────────────

users.delete(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", deleteUserBodySchema, validationErrorHook),
  async (c) => {
    const { id, hardDelete } = c.req.valid("json");

    const existingUser = await usersService.getUserById(id);

    const result = await usersService.deleteUser(id, hardDelete);

    if (existingUser.firebaseUid) {
      await FirebaseUserSync.syncUserDelete(
        existingUser.firebaseUid,
        hardDelete,
      ).catch(() => {
        // Best-effort Firebase sync - log but don't fail
      });
    }

    return c.json(result);
  },
);

// ─── GET /api/users/customers-count ──────────────────────────────────────────

users.get(
  "/customers-count",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const stats = await usersService.getCustomerStats();

    return c.json(stats);
  },
);

// ─── DELETE /api/users/delete-account ────────────────────────────────────────

users.delete(
  "/delete-account",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");

    const result = await usersService.deleteOwnAccount(auth.firebaseUser.uid);

    try {
      await adminAuth.deleteUser(auth.firebaseUser.uid);
    } catch {
      /* Best-effort Firebase deletion */
    }

    return c.json(result);
  },
);

// ─── GET /api/users/export-data ───────────────────────────────────────────────

users.get(
  "/export-data",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");

    const exportData = await usersService.exportUserData(auth.user.id);

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="my-data.json"',
      },
    });
  },
);

// ─── POST /api/users/object-to-processing ────────────────────────────────────

users.post(
  "/object-to-processing",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", objectToProcessingBodySchema, validationErrorHook),
  async (c) => {
    const { userId } = c.req.valid("json");

    const user = await usersService.objectToProcessing(userId);

    return c.json({ success: true, user });
  },
);

export default users;
