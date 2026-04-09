import { eq, and, or, ilike, desc, gte, lte, sql } from "drizzle-orm";
import {
  users as usersTable,
  orders as ordersTable,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IUsersRepository {
  listUsers(options: {
    page: number;
    limit: number;
    search?: string;
    includeDeleted: boolean;
  }): Promise<{
    users: {
      id: string;
      firebaseUid: string | null;
      name: string;
      email: string;
      phone: string | null;
      address: string | null;
      notes: string | null;
      timezone: string | null;
      role: string;
      isActive: boolean;
      isDeleted: boolean;
      deletedAt: Date | null;
      lastLogin: Date | null;
      hasUsedFreeTrial: boolean;
      createdAt: Date;
      updatedAt: Date;
    }[];
    total: number;
  }>;

  findById(id: string): Promise<{
    id: string;
    firebaseUid: string | null;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    timezone: string | null;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    lastLogin: Date | null;
    hasUsedFreeTrial: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null>;

  createUser(data: {
    name: string;
    email: string;
    firebaseUid?: string | null;
    role: string;
    timezone?: string;
  }): Promise<{
    id: string;
    firebaseUid: string | null;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    timezone: string | null;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    lastLogin: Date | null;
    hasUsedFreeTrial: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;

  updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      role?: string;
      isActive?: boolean;
      timezone?: string;
      hasUsedFreeTrial?: boolean;
    },
  ): Promise<{
    id: string;
    firebaseUid: string | null;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    timezone: string | null;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    lastLogin: Date | null;
    hasUsedFreeTrial: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;

  deleteUser(id: string, hardDelete: boolean): Promise<void>;

  softDeleteUser(id: string): Promise<void>;

  getCustomerStats(options: {
    startOfThisMonth: Date;
    startOfLastMonth: Date;
    endOfLastMonth: Date;
    now: Date;
  }): Promise<{
    totalCustomers: number;
    thisMonthCustomers: number;
    lastMonthCustomers: number;
  }>;

  findByFirebaseUid(firebaseUid: string): Promise<{
    id: string;
    firebaseUid: string | null;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    timezone: string | null;
    role: string;
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    lastLogin: Date | null;
    hasUsedFreeTrial: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null>;

  getUserOrders(userId: string): Promise<
    {
      id: string;
      status: string | null;
      totalAmount: string;
      createdAt: Date;
    }[]
  >;
}

export class UsersRepository implements IUsersRepository {
  constructor(private readonly db: AppDb) {}

  async listUsers(options: {
    page: number;
    limit: number;
    search?: string;
    includeDeleted: boolean;
  }) {
    const { page, limit, search, includeDeleted } = options;
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

    const [users, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(usersTable)
        .where(whereClause)
        .orderBy(desc(usersTable.isActive), desc(usersTable.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(whereClause),
    ]);

    return { users, total };
  }

  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    return user ?? null;
  }

  async findByFirebaseUid(firebaseUid: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.firebaseUid, firebaseUid),
          eq(usersTable.isDeleted, false),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  async createUser(data: {
    name: string;
    email: string;
    firebaseUid?: string | null;
    role: string;
    timezone?: string;
  }) {
    const [newUser] = await this.db
      .insert(usersTable)
      .values({
        name: data.name,
        email: data.email,
        firebaseUid: data.firebaseUid ?? null,
        role: data.role,
        isActive: true,
        timezone: data.timezone ?? "UTC",
      })
      .returning();

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    return newUser;
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      role?: string;
      isActive?: boolean;
      timezone?: string;
      hasUsedFreeTrial?: boolean;
    },
  ) {
    const [updated] = await this.db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update user");
    }

    return updated;
  }

  async deleteUser(id: string, hardDelete: boolean): Promise<void> {
    if (hardDelete) {
      await this.db.delete(usersTable).where(eq(usersTable.id, id));
    } else {
      await this.db
        .update(usersTable)
        .set({ isActive: false })
        .where(eq(usersTable.id, id));
    }
  }

  async softDeleteUser(id: string): Promise<void> {
    await this.db
      .update(usersTable)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        name: "Deleted User",
        email: `deleted-${id}@example.com`,
        phone: null,
        address: null,
        firebaseUid: null,
        isActive: false,
      })
      .where(eq(usersTable.id, id));
  }

  async getCustomerStats(options: {
    startOfThisMonth: Date;
    startOfLastMonth: Date;
    endOfLastMonth: Date;
    now: Date;
  }) {
    const { startOfThisMonth, startOfLastMonth, endOfLastMonth, now } = options;

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
      this.db
        .select({ totalCustomers: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(baseWhere),
      this.db
        .select({ thisMonthCustomers: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(
          and(
            baseWhere,
            gte(usersTable.createdAt, startOfThisMonth),
            lte(usersTable.createdAt, now),
          ),
        ),
      this.db
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

    return {
      totalCustomers,
      thisMonthCustomers,
      lastMonthCustomers,
    };
  }

  async getUserOrders(userId: string) {
    return this.db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        totalAmount: ordersTable.totalAmount,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(eq(ordersTable.userId, userId));
  }
}
