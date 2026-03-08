import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  users as usersTable,
  orders as ordersTable,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, or, ilike, desc, gte, lte, sql } from "drizzle-orm";
import { adminAuth } from "../../services/firebase/admin";
import { FirebaseUserSync } from "../../services/firebase/sync";
import { debugLog } from "../../utils/debug/debug";

const users = new Hono<HonoEnv>();

// ─── GET /api/users ───────────────────────────────────────────────────────────

users.get("/", rateLimiter("admin"), authMiddleware("admin"), async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const search = c.req.query("search");
    const includeDeleted = c.req.query("includeDeleted") === "true";
    const skip = (page - 1) * limit;

    const conditions = [
      ...(includeDeleted ? [] : [eq(usersTable.isDeleted, false)]),
      ...(search
        ? [
            or(
              ilike(usersTable.name, `%${search}%`),
              ilike(usersTable.email, `%${search}%`),
            ),
          ]
        : []),
    ];
    const whereClause =
      conditions.length > 0 ? and(...(conditions as any)) : undefined;

    const [allUsers, [{ total }]] = await Promise.all([
      db
        .select()
        .from(usersTable)
        .where(whereClause)
        .orderBy(desc(usersTable.isActive), desc(usersTable.createdAt))
        .limit(limit)
        .offset(skip),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(whereClause),
    ]);

    const totalPages = Math.ceil(total / limit);
    return c.json({
      users: allUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    debugLog.error("Failed to fetch users", {
      service: "users-route",
      operation: "getUsers",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

users.post(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const { name, email, password, createInFirebase, timezone } =
        await c.req.json();

      let firebaseUid: string | null = null;

      if (createInFirebase) {
        const syncResult = await FirebaseUserSync.syncUserCreate({
          email,
          name,
          password,
          role: "user",
        });
        if (!syncResult.success) {
          return c.json(
            { error: `Failed to create Firebase user: ${syncResult.error}` },
            500,
          );
        }
        firebaseUid = syncResult.firebaseUid || null;
      }

      const [newUser] = await db
        .insert(usersTable)
        .values({
          name,
          email,
          firebaseUid,
          role: "user",
          isActive: true,
          timezone: timezone || "UTC",
        })
        .returning();

      return c.json(newUser, 201);
    } catch (error) {
      debugLog.error("Failed to create user", {
        service: "users-route",
        operation: "createUser",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create user" }, 500);
    }
  },
);

// ─── PATCH /api/users ─────────────────────────────────────────────────────────

users.patch(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
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
      } = await c.req.json();

      if (!id) return c.json({ error: "User id is required" }, 400);

      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);
      if (!existingUser) return c.json({ error: "User not found" }, 404);

      const updateData: Record<string, unknown> = {};
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (role !== undefined) updateData.role = role;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (timezone !== undefined) updateData.timezone = timezone;

      const [updatedUser] = await db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, id))
        .returning();

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
          ).catch((err) =>
            debugLog.warn("Failed to sync user update to Firebase", {
              service: "users-route",
              operation: "updateUser",
              error: err instanceof Error ? err.message : "Unknown error",
            }),
          );
        }
      }

      return c.json(updatedUser);
    } catch (error) {
      debugLog.error("Failed to update user", {
        service: "users-route",
        operation: "updateUser",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update user" }, 500);
    }
  },
);

// ─── DELETE /api/users ────────────────────────────────────────────────────────

users.delete(
  "/",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const { id, hardDelete = false } = await c.req.json();

      if (!id) return c.json({ error: "User id is required" }, 400);

      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);
      if (!existingUser) return c.json({ error: "User not found" }, 404);

      if (hardDelete) {
        await db.delete(usersTable).where(eq(usersTable.id, id));
      } else {
        await db
          .update(usersTable)
          .set({ isActive: false })
          .where(eq(usersTable.id, id));
      }

      if (existingUser.firebaseUid) {
        await FirebaseUserSync.syncUserDelete(
          existingUser.firebaseUid,
          hardDelete,
        ).catch((err) =>
          debugLog.warn("Failed to sync user deletion to Firebase", {
            service: "users-route",
            operation: "deleteUser",
            error: err instanceof Error ? err.message : "Unknown error",
          }),
        );
      }

      return c.json({
        success: true,
        message: hardDelete ? "User deleted permanently" : "User deactivated",
      });
    } catch (error) {
      debugLog.error("Failed to delete user", {
        service: "users-route",
        operation: "deleteUser",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete user" }, 500);
    }
  },
);

// ─── GET /api/users/customers-count ──────────────────────────────────────────

users.get(
  "/customers-count",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);

      const baseWhere = and(
        eq(usersTable.role, "user"),
        eq(usersTable.isActive, true),
        eq(usersTable.isDeleted, false),
      );
      const [
        [{ totalCustomers }],
        [{ thisMonthCustomers }],
        [{ lastMonthCustomers }],
      ] = await Promise.all([
        db
          .select({ totalCustomers: sql<number>`count(*)::int` })
          .from(usersTable)
          .where(baseWhere),
        db
          .select({ thisMonthCustomers: sql<number>`count(*)::int` })
          .from(usersTable)
          .where(
            and(
              baseWhere,
              gte(usersTable.createdAt, startOfThisMonth),
              lte(usersTable.createdAt, now),
            ),
          ),
        db
          .select({ lastMonthCustomers: sql<number>`count(*)::int` })
          .from(usersTable)
          .where(
            and(
              baseWhere,
              gte(usersTable.createdAt, startOfLastMonth),
              lte(usersTable.createdAt, endOfLastMonth),
            ),
          ),
      ]);

      let percentChange = 0;
      if (lastMonthCustomers > 0) {
        percentChange =
          ((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) *
          100;
      } else if (thisMonthCustomers > 0) {
        percentChange = 100;
      }

      return c.json({
        totalCustomers,
        thisMonthCustomers,
        lastMonthCustomers,
        percentChange,
      });
    } catch (error) {
      debugLog.error("Failed to fetch customers count", {
        service: "users-route",
        operation: "getCustomersCount",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch customers count" }, 500);
    }
  },
);

// ─── DELETE /api/users/delete-account ────────────────────────────────────────

users.delete(
  "/delete-account",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const [user] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.firebaseUid, auth.firebaseUser.uid),
            eq(usersTable.isDeleted, false),
          ),
        )
        .limit(1);

      if (!user) return c.json({ error: "User not found" }, 404);

      await db
        .update(usersTable)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          name: "Deleted User",
          email: `deleted-${user.id}@example.com`,
          phone: null,
          address: null,
          firebaseUid: null,
          isActive: false,
        })
        .where(eq(usersTable.id, user.id));

      try {
        await adminAuth.deleteUser(auth.firebaseUser.uid);
      } catch {
        /* Best-effort Firebase deletion */
      }

      return c.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
      debugLog.error("Failed to delete account", {
        service: "users-route",
        operation: "deleteAccount",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete account" }, 500);
    }
  },
);

// ─── GET /api/users/export-data ───────────────────────────────────────────────

users.get(
  "/export-data",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const [user] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          phone: usersTable.phone,
          address: usersTable.address,
          timezone: usersTable.timezone,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, auth.user.id))
        .limit(1);

      const userOrders = await db
        .select({
          id: ordersTable.id,
          status: ordersTable.status,
          totalAmount: ordersTable.totalAmount,
          createdAt: ordersTable.createdAt,
        })
        .from(ordersTable)
        .where(eq(ordersTable.userId, auth.user.id));

      const exportData = { profile: user, orders: userOrders };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="my-data.json"',
        },
      });
    } catch (error) {
      debugLog.error("Failed to export data", {
        service: "users-route",
        operation: "exportData",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to export data" }, 500);
    }
  },
);

// ─── POST /api/users/object-to-processing ────────────────────────────────────

users.post(
  "/object-to-processing",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const { userId } = await c.req.json();

      if (!userId) return c.json({ error: "userId is required" }, 400);

      const [user] = await db
        .update(usersTable)
        .set({ isActive: false })
        .where(eq(usersTable.id, userId))
        .returning();

      return c.json({ success: true, user });
    } catch (error) {
      debugLog.error("Failed to update user processing status", {
        service: "users-route",
        operation: "updateProcessingStatus",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update user" }, 500);
    }
  },
);

export default users;
