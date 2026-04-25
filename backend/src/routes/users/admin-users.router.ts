import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { usersService } from "../../domain/singletons";
import {
  adminCreateUserWithFirebase,
  adminDeleteUserWithFirebase,
  adminUpdateUserWithFirebase,
} from "../../domain/users/users-admin-commands";
import {
  createUserBodySchema,
  deleteUserBodySchema,
  objectToProcessingBodySchema,
  updateUserBodySchema,
  usersListQuerySchema,
} from "../../domain/users/users.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const adminUsersRouter = new Hono<HonoEnv>();

adminUsersRouter.get(
  "/",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", usersListQuerySchema, zodValidationErrorHook),
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

adminUsersRouter.post(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", createUserBodySchema, zodValidationErrorHook),
  async (c) => {
    const { name, email, password, createInFirebase, timezone } =
      c.req.valid("json");

    const newUser = await adminCreateUserWithFirebase(usersService, {
      name,
      email,
      password,
      createInFirebase,
      timezone,
    });

    return c.json(newUser, 201);
  },
);

adminUsersRouter.patch(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", updateUserBodySchema, zodValidationErrorHook),
  async (c) => {
    const body = c.req.valid("json");
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
    } = body;

    const updatedUser = await adminUpdateUserWithFirebase(usersService, {
      id,
      phone,
      address,
      role,
      name,
      email,
      isActive,
      timezone,
    });

    return c.json(updatedUser);
  },
);

adminUsersRouter.delete(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", deleteUserBodySchema, zodValidationErrorHook),
  async (c) => {
    const { id, hardDelete } = c.req.valid("json");

    const result = await adminDeleteUserWithFirebase(
      usersService,
      id,
      hardDelete,
    );

    return c.json(result);
  },
);

adminUsersRouter.post(
  "/object-to-processing",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", objectToProcessingBodySchema, zodValidationErrorHook),
  async (c) => {
    const { userId } = c.req.valid("json");

    const user = await usersService.objectToProcessing(userId);

    return c.json({ success: true, user });
  },
);

export default adminUsersRouter;
