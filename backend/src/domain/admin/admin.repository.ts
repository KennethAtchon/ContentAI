import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  users,
  orders,
  featureUsages,
  aiCostLedger,
  musicTracks,
  niches,
  reels,
  reelAnalyses,
  assets,
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

  // Music management
  listMusicTracks(search?: string): Promise<
    {
      id: string;
      assetId: string;
      name: string;
      artistName: string | null;
      durationSeconds: number | null;
      mood: string | null;
      genre: string | null;
      isActive: boolean | null;
      uploadedBy: string | null;
      createdAt: Date | null;
      r2Key: string | null;
    }[]
  >;

  findMusicTrackById(id: string): Promise<
    | {
        id: string;
        assetId: string;
        name: string;
        artistName: string | null;
        durationSeconds: number | null;
        mood: string | null;
        genre: string | null;
        isActive: boolean | null;
        uploadedBy: string | null;
        createdAt: Date | null;
      }
    | undefined
  >;

  updateMusicTrack(
    id: string,
    data: {
      isActive?: boolean;
      name?: string;
      artistName?: string | null;
      mood?: string;
      genre?: string | null;
    },
  ): Promise<
    | {
        id: string;
        assetId: string;
        name: string;
        artistName: string | null;
        durationSeconds: number | null;
        mood: string | null;
        genre: string | null;
        isActive: boolean | null;
        uploadedBy: string | null;
        createdAt: Date | null;
      }
    | undefined
  >;

  deleteMusicTrack(id: string): Promise<boolean>;

  // Niches management
  listNiches(
    search?: string,
    activeOnly?: boolean,
  ): Promise<
    {
      id: number;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      reelCount: number;
      scrapeLimit: number;
      scrapeMinViews: number;
      scrapeMaxDaysOld: number;
      scrapeIncludeViralOnly: boolean;
    }[]
  >;

  findNicheById(id: number): Promise<
    | {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        scrapeLimit: number;
        scrapeMinViews: number;
        scrapeMaxDaysOld: number;
        scrapeIncludeViralOnly: boolean;
      }
    | undefined
  >;

  createNiche(data: { name: string; description?: string }): Promise<{
    id: number;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;

  updateNiche(
    id: number,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ): Promise<
    | {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined
  >;

  updateNicheConfig(
    id: number,
    data: {
      scrapeLimit?: number;
      scrapeMinViews?: number;
      scrapeMaxDaysOld?: number;
      scrapeIncludeViralOnly?: boolean;
    },
  ): Promise<
    | {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        scrapeLimit: number;
        scrapeMinViews: number;
        scrapeMaxDaysOld: number;
        scrapeIncludeViralOnly: boolean;
      }
    | undefined
  >;

  deleteNiche(id: number): Promise<boolean>;

  listNicheReels(
    nicheId: number,
    options: {
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: string;
      viral?: string;
      hasVideo?: string;
    },
  ): Promise<{
    reels: Array<{
      id: number;
      externalId: string | null;
      username: string;
      nicheId: number;
      views: number;
      likes: number;
      comments: number;
      engagementRate: string | null;
      hook: string | null;
      caption: string | null;
      audioName: string | null;
      videoUrl: string | null;
      videoR2Url: string | null;
      isViral: boolean;
      postedAt: Date | null;
      scrapedAt: Date;
      createdAt: Date;
      hasAnalysis: boolean;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  dedupeNicheReels(nicheId: number): Promise<{ deletedCount: number }>;

  pingDatabase(): Promise<void>;

  selectDynamicTableRows(
    table: PgTable,
    whereClause: SQL | undefined,
    limit: number,
    offset: number,
  ): Promise<unknown[]>;

  countDynamicTableRows(
    table: PgTable,
    whereClause: SQL | undefined,
  ): Promise<number>;

  findUserByFirebaseUid(
    firebaseUid: string,
  ): Promise<{ id: string; name: string | null; email: string | null } | null>;

  countFeatureUsagesSince(
    userId: string,
    featureType: string,
    since: Date,
  ): Promise<number>;

  findNicheForScrapeJob(id: number): Promise<{
    id: number;
    name: string;
    scrapeLimit: number;
    scrapeMinViews: number;
    scrapeMaxDaysOld: number;
    scrapeIncludeViralOnly: boolean;
    isActive: boolean;
  } | null>;

  listActiveNichesForDailyScan(): Promise<{ id: number; name: string }[]>;

  insertNicheScrapeJob(params: {
    nicheId: number;
    limit: number;
    minViews: number;
    maxDaysOld: number;
    viralOnly: boolean;
  }): Promise<{ id: string }>;

  insertPlatformMusicTrack(params: {
    trackId: string;
    adminUserId: string;
    name: string;
    artistName: string | null;
    mood: string;
    genre: string | null;
    r2Key: string;
    r2Url: string;
    fileSize: number;
    durationSeconds: number;
  }): Promise<{ track: typeof musicTracks.$inferSelect }>;

  findMusicTrackForPlatformDelete(id: string): Promise<{
    trackId: string;
    assetId: string;
    r2Key: string | null;
  } | null>;

  deletePlatformMusicTrackAndAsset(
    trackId: string,
    assetId: string,
  ): Promise<void>;

  insertAiCostLedgerRow(values: {
    userId: string | null;
    provider: string;
    model: string;
    featureType: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: string;
    outputCost: string;
    totalCost: string;
    durationMs: number;
    metadata: Record<string, unknown> | null;
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
      this.db.select({ total: sql<number>`count(*)::int` }).from(featureUsages),
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
        and(gte(aiCostLedger.createdAt, periodStart), sql`user_id is not null`),
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

  // Music management
  async listMusicTracks(search?: string) {
    const conditions = search
      ? or(
          ilike(musicTracks.name, `%${search}%`),
          ilike(musicTracks.artistName, `%${search}%`),
        )
      : undefined;

    return this.db
      .select({
        id: musicTracks.id,
        assetId: musicTracks.assetId,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        durationSeconds: musicTracks.durationSeconds,
        mood: musicTracks.mood,
        genre: musicTracks.genre,
        isActive: musicTracks.isActive,
        uploadedBy: musicTracks.uploadedBy,
        createdAt: musicTracks.createdAt,
        r2Key: assets.r2Key,
      })
      .from(musicTracks)
      .innerJoin(assets, eq(musicTracks.assetId, assets.id))
      .where(conditions)
      .orderBy(desc(musicTracks.createdAt));
  }

  async findMusicTrackById(id: string) {
    const [track] = await this.db
      .select({
        id: musicTracks.id,
        assetId: musicTracks.assetId,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        durationSeconds: musicTracks.durationSeconds,
        mood: musicTracks.mood,
        genre: musicTracks.genre,
        isActive: musicTracks.isActive,
        uploadedBy: musicTracks.uploadedBy,
        createdAt: musicTracks.createdAt,
      })
      .from(musicTracks)
      .where(eq(musicTracks.id, id))
      .limit(1);

    return track;
  }

  async updateMusicTrack(
    id: string,
    data: {
      isActive?: boolean;
      name?: string;
      artistName?: string | null;
      mood?: string;
      genre?: string | null;
    },
  ) {
    const [updated] = await this.db
      .update(musicTracks)
      .set(data)
      .where(eq(musicTracks.id, id))
      .returning({
        id: musicTracks.id,
        assetId: musicTracks.assetId,
        name: musicTracks.name,
        artistName: musicTracks.artistName,
        durationSeconds: musicTracks.durationSeconds,
        mood: musicTracks.mood,
        genre: musicTracks.genre,
        isActive: musicTracks.isActive,
        uploadedBy: musicTracks.uploadedBy,
        createdAt: musicTracks.createdAt,
      });

    return updated;
  }

  async deleteMusicTrack(id: string): Promise<boolean> {
    const result = await this.db
      .delete(musicTracks)
      .where(eq(musicTracks.id, id))
      .returning();
    return result.length > 0;
  }

  // Niches management
  async listNiches(search?: string, activeOnly?: boolean) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (activeOnly) conditions.push(eq(niches.isActive, true));

    return this.db
      .select({
        id: niches.id,
        name: niches.name,
        description: niches.description,
        isActive: niches.isActive,
        createdAt: niches.createdAt,
        updatedAt: niches.updatedAt,
        reelCount: sql<number>`count(${reels.id})::int`,
        scrapeLimit: niches.scrapeLimit,
        scrapeMinViews: niches.scrapeMinViews,
        scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
        scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
      })
      .from(niches)
      .leftJoin(reels, eq(reels.nicheId, niches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(niches.id)
      .orderBy(desc(niches.createdAt));
  }

  async findNicheById(id: number) {
    const [niche] = await this.db
      .select({
        id: niches.id,
        name: niches.name,
        description: niches.description,
        isActive: niches.isActive,
        createdAt: niches.createdAt,
        updatedAt: niches.updatedAt,
        scrapeLimit: niches.scrapeLimit,
        scrapeMinViews: niches.scrapeMinViews,
        scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
        scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
      })
      .from(niches)
      .where(eq(niches.id, id))
      .limit(1);

    return niche;
  }

  async createNiche(data: { name: string; description?: string }) {
    const [niche] = await this.db
      .insert(niches)
      .values({
        name: data.name,
        description: data.description,
        isActive: true,
      })
      .returning({
        id: niches.id,
        name: niches.name,
        description: niches.description,
        isActive: niches.isActive,
        createdAt: niches.createdAt,
        updatedAt: niches.updatedAt,
      });

    if (!niche) throw new Error("Failed to create niche");
    return niche;
  }

  async updateNiche(
    id: number,
    data: { name?: string; description?: string; isActive?: boolean },
  ) {
    const [updated] = await this.db
      .update(niches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(niches.id, id))
      .returning({
        id: niches.id,
        name: niches.name,
        description: niches.description,
        isActive: niches.isActive,
        createdAt: niches.createdAt,
        updatedAt: niches.updatedAt,
      });

    return updated;
  }

  async updateNicheConfig(
    id: number,
    data: {
      scrapeLimit?: number;
      scrapeMinViews?: number;
      scrapeMaxDaysOld?: number;
      scrapeIncludeViralOnly?: boolean;
    },
  ) {
    const [updated] = await this.db
      .update(niches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(niches.id, id))
      .returning({
        id: niches.id,
        name: niches.name,
        description: niches.description,
        isActive: niches.isActive,
        createdAt: niches.createdAt,
        updatedAt: niches.updatedAt,
        scrapeLimit: niches.scrapeLimit,
        scrapeMinViews: niches.scrapeMinViews,
        scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
        scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
      });

    return updated;
  }

  async deleteNiche(id: number): Promise<boolean> {
    const result = await this.db
      .delete(niches)
      .where(eq(niches.id, id))
      .returning();
    return result.length > 0;
  }

  async listNicheReels(
    nicheId: number,
    options: {
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: string;
      viral?: string;
      hasVideo?: string;
    },
  ) {
    const offset = (options.page - 1) * options.limit;

    const sortCol =
      {
        views: reels.views,
        likes: reels.likes,
        engagement: reels.engagementRate,
        postedAt: reels.postedAt,
        scrapedAt: reels.scrapedAt,
      }[options.sortBy] ?? reels.views;

    const order = options.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

    const whereConditions = [eq(reels.nicheId, nicheId)];
    if (options.viral === "true") whereConditions.push(eq(reels.isViral, true));
    if (options.viral === "false")
      whereConditions.push(eq(reels.isViral, false));
    if (options.hasVideo === "true")
      whereConditions.push(isNotNull(reels.videoR2Url));

    const where = and(...whereConditions);

    const [reelRows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(reels)
        .where(where)
        .orderBy(order)
        .limit(options.limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(reels)
        .where(where),
    ]);

    // Get analysis status
    const reelIds = reelRows.map((r) => r.id);
    const analysisRows =
      reelIds.length > 0
        ? await this.db
            .select({ reelId: reelAnalyses.reelId })
            .from(reelAnalyses)
            .where(
              sql`${reelAnalyses.reelId} = ANY(${sql.raw(`ARRAY[${reelIds.join(",")}]`)})`,
            )
        : [];
    const analyzedIds = new Set(analysisRows.map((a) => a.reelId));

    return {
      reels: reelRows.map((r) => ({
        ...r,
        hasAnalysis: analyzedIds.has(r.id),
      })),
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  async dedupeNicheReels(nicheId: number) {
    await this.db.execute(sql`
      DELETE FROM "reel"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "external_id" ORDER BY id ASC) as rn
          FROM "reel"
          WHERE niche_id = ${nicheId}
        ) sub
        WHERE rn > 1
      )
    `);

    return { deletedCount: 0 };
  }

  async pingDatabase() {
    await this.db.execute(sql`SELECT 1`);
  }

  async selectDynamicTableRows(
    table: PgTable,
    whereClause: SQL | undefined,
    limit: number,
    offset: number,
  ) {
    if (whereClause !== undefined) {
      return this.db
        .select()
        .from(table as never)
        .where(whereClause)
        .limit(limit)
        .offset(offset);
    }
    return this.db
      .select()
      .from(table as never)
      .limit(limit)
      .offset(offset);
  }

  async countDynamicTableRows(table: PgTable, whereClause: SQL | undefined) {
    type CountRow = { count: number };
    if (whereClause !== undefined) {
      const rows = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(whereClause);
      const row = rows[0] as CountRow | undefined;
      return row?.count ?? 0;
    }
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(table);
    const row = rows[0] as CountRow | undefined;
    return row?.count ?? 0;
  }

  async findUserByFirebaseUid(firebaseUid: string) {
    const [row] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);
    return row ?? null;
  }

  async countFeatureUsagesSince(
    userId: string,
    featureType: string,
    since: Date,
  ) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(featureUsages)
      .where(
        and(
          eq(featureUsages.userId, userId),
          eq(featureUsages.featureType, featureType),
          gte(featureUsages.createdAt, since),
        ),
      );
    return row?.count ?? 0;
  }

  async findNicheForScrapeJob(id: number) {
    const [niche] = await this.db
      .select({
        id: niches.id,
        name: niches.name,
        scrapeLimit: niches.scrapeLimit,
        scrapeMinViews: niches.scrapeMinViews,
        scrapeMaxDaysOld: niches.scrapeMaxDaysOld,
        scrapeIncludeViralOnly: niches.scrapeIncludeViralOnly,
        isActive: niches.isActive,
      })
      .from(niches)
      .where(eq(niches.id, id))
      .limit(1);
    return niche ?? null;
  }

  async listActiveNichesForDailyScan(): Promise<
    { id: number; name: string }[]
  > {
    return this.db
      .select({ id: niches.id, name: niches.name })
      .from(niches)
      .where(eq(niches.isActive, true));
  }

  async insertNicheScrapeJob(params: {
    nicheId: number;
    limit: number;
    minViews: number;
    maxDaysOld: number;
    viralOnly: boolean;
  }) {
    const [job] = await this.db
      .insert(reelAnalyses)
      .values({
        nicheId: params.nicheId,
        status: "pending",
        config: {
          limit: params.limit,
          minViews: params.minViews,
          maxDaysOld: params.maxDaysOld,
          viralOnly: params.viralOnly,
        },
      } as never)
      .returning({ id: reelAnalyses.id });
    if (!job) throw new Error("Failed to create scan job");
    return job;
  }

  async insertPlatformMusicTrack(params: {
    trackId: string;
    adminUserId: string;
    name: string;
    artistName: string | null;
    mood: string;
    genre: string | null;
    r2Key: string;
    r2Url: string;
    fileSize: number;
    durationSeconds: number;
  }) {
    const [asset] = await this.db
      .insert(assets)
      .values({
        id: params.trackId,
        userId: null,
        type: "audio",
        source: "platform",
        name: params.name.trim(),
        mimeType: "audio/mpeg",
        r2Key: params.r2Key,
        r2Url: params.r2Url,
        sizeBytes: params.fileSize,
        durationMs: params.durationSeconds * 1000,
        metadata: {
          artistName: params.artistName,
          mood: params.mood,
          genre: params.genre,
        },
      })
      .returning();

    if (!asset) throw new Error("Failed to insert music asset");

    const [track] = await this.db
      .insert(musicTracks)
      .values({
        id: params.trackId,
        assetId: asset.id,
        name: params.name.trim(),
        artistName: params.artistName,
        durationSeconds: params.durationSeconds,
        mood: params.mood,
        genre: params.genre,
        isActive: true,
        uploadedBy: params.adminUserId,
      })
      .returning();

    if (!track) throw new Error("Failed to insert music track");
    return { track };
  }

  async findMusicTrackForPlatformDelete(id: string) {
    const [existing] = await this.db
      .select({
        trackId: musicTracks.id,
        assetId: musicTracks.assetId,
        r2Key: assets.r2Key,
      })
      .from(musicTracks)
      .innerJoin(assets, eq(musicTracks.assetId, assets.id))
      .where(eq(musicTracks.id, id))
      .limit(1);

    if (!existing) return null;
    return {
      trackId: existing.trackId,
      assetId: existing.assetId,
      r2Key: existing.r2Key,
    };
  }

  async deletePlatformMusicTrackAndAsset(trackId: string, assetId: string) {
    await this.db.delete(musicTracks).where(eq(musicTracks.id, trackId));
    await this.db.delete(assets).where(eq(assets.id, assetId));
  }

  async insertAiCostLedgerRow(values: {
    userId: string | null;
    provider: string;
    model: string;
    featureType: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: string;
    outputCost: string;
    totalCost: string;
    durationMs: number;
    metadata: Record<string, unknown> | null;
  }) {
    await this.db.insert(aiCostLedger).values(values);
  }
}
