import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  users,
  orders,
  featureUsages,
  aiCostLedger,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IAdminRepository {
  fetchConversionAnalyticsRawCounts(params: {
    startOfThisMonth: Date;
    startOfLastMonth: Date;
    endOfLastMonth: Date;
    now: Date;
  }): Promise<{
    totalCustomers: number;
    customersWithPaidOrders: number;
    lastMonthCustomers: number;
    lastMonthCustomersWithPaidOrders: number;
    thisMonthCustomers: number;
    thisMonthCustomersWithPaidOrders: number;
  }>;

  listCustomersPage(params: {
    limit: number;
    skip: number;
    search?: string;
  }): Promise<{
    rows: Array<{
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      createdAt: Date;
      updatedAt: Date;
      isActive: boolean | null;
    }>;
    total: number;
  }>;

  listOrdersPage(params: {
    limit: number;
    skip: number;
    search?: string;
    customerId?: string;
  }): Promise<{
    rows: Array<{
      order: typeof orders.$inferSelect;
      user: { id: string; name: string | null; email: string | null };
    }>;
    total: number;
  }>;

  insertOrderRow(values: {
    userId: string;
    totalAmount: string;
    status: string;
  }): Promise<typeof orders.$inferSelect>;

  updateOrderRow(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<typeof orders.$inferSelect | undefined>;

  findOrderById(id: string): Promise<typeof orders.$inferSelect | undefined>;

  softDeleteOrder(
    id: string,
    deletedBy: string,
  ): Promise<typeof orders.$inferSelect | undefined>;

  findOrderWithUserById(id: string): Promise<{
    order: typeof orders.$inferSelect;
    user: { id: string; name: string | null; email: string | null };
  } | null>;

  findUserBriefById(
    userId: string,
  ): Promise<{ id: string; name: string | null; email: string | null } | null>;

  listFeatureUsagesPage(params: {
    limit: number;
    skip: number;
  }): Promise<{ rows: (typeof featureUsages.$inferSelect)[]; total: number }>;

  fetchAiCostAggregateRows(periodStart: Date): Promise<{
    totals: Array<{
      totalCost: string | null;
      totalInputTokens: number | null;
      totalOutputTokens: number | null;
      callCount: number | null;
    }>;
    byProvider: Array<{
      provider: string | null;
      totalCost: string | null;
      callCount: number | null;
    }>;
    byModel: Array<{
      provider: string | null;
      model: string | null;
      totalCost: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
      callCount: number | null;
    }>;
    byFeature: Array<{
      featureType: string | null;
      totalCost: string | null;
      callCount: number | null;
    }>;
    byDay: Array<{
      day: string | null;
      totalCost: string | null;
      callCount: number | null;
    }>;
  }>;

  fetchAiCostsByUserRows(
    periodStart: Date,
    limit: number,
  ): Promise<
    Array<{
      userId: string | null;
      totalCost: string | null;
      callCount: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
    }>
  >;

  upsertAdminUserOnVerify(params: {
    firebaseUid: string;
    email: string;
    name: string;
  }): Promise<void>;
}

export class AdminRepository implements IAdminRepository {
  constructor(private readonly db: AppDb) {}

  async fetchConversionAnalyticsRawCounts(params: {
    startOfThisMonth: Date;
    startOfLastMonth: Date;
    endOfLastMonth: Date;
    now: Date;
  }) {
    const { startOfThisMonth, startOfLastMonth, endOfLastMonth, now } = params;

    const [
      [{ totalCustomers }],
      [{ customersWithPaidOrders }],
      [{ lastMonthCustomers }],
      [{ lastMonthCustomersWithPaidOrders }],
      [{ thisMonthCustomers }],
      [{ thisMonthCustomersWithPaidOrders }],
    ] = await Promise.all([
      this.db
        .select({ totalCustomers: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, "user")),
      this.db
        .select({
          customersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
        })
        .from(users)
        .innerJoin(
          orders,
          and(eq(orders.userId, users.id), eq(orders.status, "paid")),
        )
        .where(eq(users.role, "user")),
      this.db
        .select({ lastMonthCustomers: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.role, "user"),
            gte(users.createdAt, startOfLastMonth),
            lte(users.createdAt, endOfLastMonth),
          ),
        ),
      this.db
        .select({
          lastMonthCustomersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
        })
        .from(users)
        .innerJoin(
          orders,
          and(
            eq(orders.userId, users.id),
            eq(orders.status, "paid"),
            gte(orders.createdAt, startOfLastMonth),
            lte(orders.createdAt, endOfLastMonth),
          ),
        )
        .where(
          and(
            eq(users.role, "user"),
            gte(users.createdAt, startOfLastMonth),
            lte(users.createdAt, endOfLastMonth),
          ),
        ),
      this.db
        .select({ thisMonthCustomers: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.role, "user"),
            gte(users.createdAt, startOfThisMonth),
            lte(users.createdAt, now),
          ),
        ),
      this.db
        .select({
          thisMonthCustomersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
        })
        .from(users)
        .innerJoin(
          orders,
          and(
            eq(orders.userId, users.id),
            eq(orders.status, "paid"),
            gte(orders.createdAt, startOfThisMonth),
            lte(orders.createdAt, now),
          ),
        )
        .where(
          and(
            eq(users.role, "user"),
            gte(users.createdAt, startOfThisMonth),
            lte(users.createdAt, now),
          ),
        ),
    ]);

    return {
      totalCustomers,
      customersWithPaidOrders,
      lastMonthCustomers,
      lastMonthCustomersWithPaidOrders,
      thisMonthCustomers,
      thisMonthCustomersWithPaidOrders,
    };
  }

  async listCustomersPage(params: {
    limit: number;
    skip: number;
    search?: string;
  }) {
    const customerWhere = and(
      eq(users.role, "user"),
      params.search ? ilike(users.email, `%${params.search}%`) : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          address: users.address,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          isActive: users.isActive,
        })
        .from(users)
        .where(customerWhere)
        .orderBy(desc(users.createdAt))
        .limit(params.limit)
        .offset(params.skip),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(customerWhere),
    ]);

    return { rows, total };
  }

  async listOrdersPage(params: {
    limit: number;
    skip: number;
    search?: string;
    customerId?: string;
  }) {
    const orderWhere = and(
      eq(orders.isDeleted, false),
      params.customerId ? eq(orders.userId, params.customerId) : undefined,
      params.search?.trim()
        ? or(
            ilike(orders.id, `%${params.search}%`),
            ilike(users.name, `%${params.search}%`),
            ilike(users.email, `%${params.search}%`),
          )
        : undefined,
    );

    const [orderRows, [{ total }]] = await Promise.all([
      this.db
        .select({
          order: orders,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(orders)
        .innerJoin(users, eq(orders.userId, users.id))
        .where(orderWhere)
        .orderBy(desc(orders.createdAt))
        .limit(params.limit)
        .offset(params.skip),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(orderWhere),
    ]);

    return { rows: orderRows, total };
  }

  async insertOrderRow(values: {
    userId: string;
    totalAmount: string;
    status: string;
  }) {
    const [row] = await this.db.insert(orders).values(values).returning();
    if (!row) throw new Error("Failed to insert order");
    return row;
  }

  async updateOrderRow(id: string, patch: Record<string, unknown>) {
    const [row] = await this.db
      .update(orders)
      .set(patch)
      .where(eq(orders.id, id))
      .returning();
    return row;
  }

  async findOrderById(id: string) {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    return row;
  }

  async softDeleteOrder(id: string, deletedBy: string) {
    const [row] = await this.db
      .update(orders)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy,
      })
      .where(eq(orders.id, id))
      .returning();
    return row;
  }

  async findOrderWithUserById(id: string) {
    const [orderRow] = await this.db
      .select({
        order: orders,
        user: { id: users.id, name: users.name, email: users.email },
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id))
      .limit(1);
    return orderRow ?? null;
  }

  async findUserBriefById(userId: string) {
    const [row] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async listFeatureUsagesPage(params: { limit: number; skip: number }) {
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(featureUsages)
        .orderBy(desc(featureUsages.createdAt))
        .limit(params.limit)
        .offset(params.skip),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(featureUsages),
    ]);
    return { rows, total };
  }

  async fetchAiCostAggregateRows(periodStart: Date) {
    const [totals, byProvider, byModel, byFeature, byDay] = await Promise.all([
      this.db
        .select({
          totalCost: sql<string>`sum(total_cost)::text`,
          totalInputTokens: sql<number>`sum(input_tokens)::int`,
          totalOutputTokens: sql<number>`sum(output_tokens)::int`,
          callCount: sql<number>`count(*)::int`,
        })
        .from(aiCostLedger)
        .where(gte(aiCostLedger.createdAt, periodStart)),
      this.db
        .select({
          provider: aiCostLedger.provider,
          totalCost: sql<string>`sum(total_cost)::text`,
          callCount: sql<number>`count(*)::int`,
        })
        .from(aiCostLedger)
        .where(gte(aiCostLedger.createdAt, periodStart))
        .groupBy(aiCostLedger.provider)
        .orderBy(sql`sum(total_cost) desc`),
      this.db
        .select({
          provider: aiCostLedger.provider,
          model: aiCostLedger.model,
          totalCost: sql<string>`sum(total_cost)::text`,
          inputTokens: sql<number>`sum(input_tokens)::int`,
          outputTokens: sql<number>`sum(output_tokens)::int`,
          callCount: sql<number>`count(*)::int`,
        })
        .from(aiCostLedger)
        .where(gte(aiCostLedger.createdAt, periodStart))
        .groupBy(aiCostLedger.provider, aiCostLedger.model)
        .orderBy(sql`sum(total_cost) desc`),
      this.db
        .select({
          featureType: aiCostLedger.featureType,
          totalCost: sql<string>`sum(total_cost)::text`,
          callCount: sql<number>`count(*)::int`,
        })
        .from(aiCostLedger)
        .where(gte(aiCostLedger.createdAt, periodStart))
        .groupBy(aiCostLedger.featureType)
        .orderBy(sql`sum(total_cost) desc`),
      this.db
        .select({
          day: sql<string>`date_trunc('day', created_at)::text`,
          totalCost: sql<string>`sum(total_cost)::text`,
          callCount: sql<number>`count(*)::int`,
        })
        .from(aiCostLedger)
        .where(gte(aiCostLedger.createdAt, periodStart))
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at) asc`),
    ]);

    return { totals, byProvider, byModel, byFeature, byDay };
  }

  async fetchAiCostsByUserRows(periodStart: Date, limit: number) {
    return this.db
      .select({
        userId: aiCostLedger.userId,
        totalCost: sql<string>`sum(total_cost)::text`,
        callCount: sql<number>`count(*)::int`,
        inputTokens: sql<number>`sum(input_tokens)::int`,
        outputTokens: sql<number>`sum(output_tokens)::int`,
      })
      .from(aiCostLedger)
      .where(
        and(
          gte(aiCostLedger.createdAt, periodStart),
          sql`user_id is not null`,
        ),
      )
      .groupBy(aiCostLedger.userId)
      .orderBy(sql`sum(total_cost) desc`)
      .limit(limit);
  }

  async upsertAdminUserOnVerify(params: {
    firebaseUid: string;
    email: string;
    name: string;
  }) {
    await this.db
      .insert(users)
      .values({
        firebaseUid: params.firebaseUid,
        email: params.email,
        name: params.name,
        role: "admin",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: { role: "admin", lastLogin: new Date() },
      });
  }
}
