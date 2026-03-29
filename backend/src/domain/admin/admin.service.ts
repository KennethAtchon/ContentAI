import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  getMonthBoundaries,
  calculatePercentChange,
} from "../../utils/helpers/date";
import { formatOrderResponse } from "../../utils/helpers/order-helpers";
import { Errors } from "../../utils/errors/app-error";
import type { IAdminRepository } from "./admin.repository";

export class AdminService {
  constructor(private readonly repo: IAdminRepository) {}

  async getConversionAnalytics() {
    const now = new Date();
    const { startOfThisMonth, startOfLastMonth, endOfLastMonth } =
      getMonthBoundaries();

    const counts = await this.repo.fetchConversionAnalyticsRawCounts({
      startOfThisMonth,
      startOfLastMonth,
      endOfLastMonth,
      now,
    });

    const {
      totalCustomers,
      customersWithPaidOrders,
      lastMonthCustomers,
      lastMonthCustomersWithPaidOrders,
      thisMonthCustomers,
      thisMonthCustomersWithPaidOrders,
    } = counts;

    const conversionRate =
      totalCustomers > 0
        ? (customersWithPaidOrders / totalCustomers) * 100
        : 0;
    const lastMonthConversionRate =
      lastMonthCustomers > 0
        ? (lastMonthCustomersWithPaidOrders / lastMonthCustomers) * 100
        : 0;
    const thisMonthConversionRate =
      thisMonthCustomers > 0
        ? (thisMonthCustomersWithPaidOrders / thisMonthCustomers) * 100
        : 0;
    const percentChange = calculatePercentChange(
      lastMonthConversionRate,
      thisMonthConversionRate,
    );

    return {
      conversionRate,
      lastMonthConversionRate,
      thisMonthConversionRate,
      percentChange,
    };
  }

  async listCustomers(query: { page: number; limit: number; search?: string }) {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.repo.listCustomersPage({
      limit: query.limit,
      skip,
      search: query.search,
    });

    const totalPages = Math.ceil(total / query.limit);
    return {
      customers: rows.map((c) => ({
        ...c,
        name: c.name || "",
        email: c.email || "",
        isActive: c.isActive !== undefined ? c.isActive : true,
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasMore: query.page < totalPages,
        hasPrevious: query.page > 1,
        showing: rows.length,
        from: skip + 1,
        to: skip + rows.length,
      },
    };
  }

  async listOrders(query: {
    page: number;
    limit: number;
    search?: string;
    customerId?: string;
  }) {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.repo.listOrdersPage({
      limit: query.limit,
      skip,
      search: query.search,
      customerId: query.customerId,
    });

    const ordersWithUser = rows.map(({ order, user }) => ({
      ...order,
      user: { name: user.name ?? "", email: user.email ?? "" },
    }));

    const totalPages = Math.ceil(total / query.limit);
    return {
      orders: ordersWithUser.map(formatOrderResponse),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasMore: query.page < totalPages,
        hasPrevious: query.page > 1,
        showing: ordersWithUser.length,
        from: skip + 1,
        to: skip + ordersWithUser.length,
      },
    };
  }

  async createOrder(body: {
    userId: string;
    totalAmount: unknown;
    status?: string;
  }) {
    const newOrder = await this.repo.insertOrderRow({
      userId: body.userId,
      totalAmount: String(body.totalAmount),
      status: body.status || "pending",
    });
    const orderUser = await this.repo.findUserBriefById(body.userId);
    const user = orderUser ?? { name: "", email: "" };
    return formatOrderResponse({
      ...newOrder,
      user: { name: user.name ?? "", email: user.email ?? "" },
    });
  }

  async updateOrder(body: {
    id: string;
    userId?: string;
    totalAmount?: unknown;
    status?: string;
  }) {
    const updateData: Record<string, unknown> = {};
    if (body.userId) updateData.userId = body.userId;
    if (body.totalAmount !== undefined)
      updateData.totalAmount = String(body.totalAmount);
    if (body.status !== undefined) updateData.status = body.status;

    const updatedOrder = await this.repo.updateOrderRow(body.id, updateData);
    if (!updatedOrder) return null;
    const orderUser = await this.repo.findUserBriefById(updatedOrder.userId);
    const user = orderUser ?? { name: "", email: "" };
    return formatOrderResponse({
      ...updatedOrder,
      user: { name: user.name ?? "", email: user.email ?? "" },
    });
  }

  async deleteOrder(body: { id: string; deletedBy?: string }) {
    const existing = await this.repo.findOrderById(body.id);
    if (!existing) return null;

    const deletedOrder = await this.repo.softDeleteOrder(
      body.id,
      body.deletedBy || "admin",
    );
    if (!deletedOrder) return null;

    const orderUser = await this.repo.findUserBriefById(deletedOrder.userId);
    const user = orderUser ?? { name: "", email: "" };
    return {
      order: formatOrderResponse({
        ...deletedOrder,
        user: { name: user.name ?? "", email: user.email ?? "" },
      }),
      deleted: true,
    };
  }

  async getOrderById(id: string) {
    const orderRow = await this.repo.findOrderWithUserById(id);
    if (!orderRow) return null;
    return formatOrderResponse({
      ...orderRow.order,
      user: {
        name: orderRow.user.name ?? "",
        email: orderRow.user.email ?? "",
      },
    });
  }

  async listFeatureUsages(query: { page: number; limit: number }) {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.repo.listFeatureUsagesPage({
      limit: query.limit,
      skip,
    });
    const totalPages = Math.ceil(total / query.limit);
    return {
      featureUsages: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasMore: query.page < totalPages,
        hasPrevious: query.page > 1,
      },
    };
  }

  async getAiCosts(period: string) {
    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case "7d":
        periodStart = new Date(now.getTime() - 7 * 86_400_000);
        break;
      case "90d":
        periodStart = new Date(now.getTime() - 90 * 86_400_000);
        break;
      case "all":
        periodStart = new Date(0);
        break;
      default:
        periodStart = new Date(now.getTime() - 30 * 86_400_000);
    }

    const { totals, byProvider, byModel, byFeature, byDay } =
      await this.repo.fetchAiCostAggregateRows(periodStart);

    return {
      period,
      totals: totals[0] ?? {
        totalCost: "0",
        totalInputTokens: 0,
        totalOutputTokens: 0,
        callCount: 0,
      },
      byProvider,
      byModel,
      byFeature,
      byDay,
    };
  }

  async getAiCostsByUser(period: string, limit: number) {
    const now = new Date();
    const periodStart =
      period === "all"
        ? new Date(0)
        : new Date(now.getTime() - parseInt(period, 10) * 86_400_000);

    const users = await this.repo.fetchAiCostsByUserRows(periodStart, limit);
    return { period, users };
  }

  async grantAdminViaCode(params: {
    firebaseUid: string;
    email: string;
    name: string;
  }) {
    await this.repo.upsertAdminUserOnVerify(params);
  }

  // Music management
  async listMusicTracks(search?: string) {
    const tracks = await this.repo.listMusicTracks(search);
    return { tracks };
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
    const track = await this.repo.updateMusicTrack(id, data);
    if (!track) {
      throw new Error("Track not found");
    }
    return { track };
  }

  async deleteMusicTrack(id: string) {
    const deleted = await this.repo.deleteMusicTrack(id);
    if (!deleted) {
      throw new Error("Track not found");
    }
    return { success: true };
  }

  // Niches management
  async listNiches(search?: string, active?: boolean) {
    const niches = await this.repo.listNiches(search, active);
    return { niches };
  }

  async createNiche(data: { name: string; description?: string }) {
    const niche = await this.repo.createNiche(data);
    return { niche };
  }

  async updateNiche(
    id: number,
    data: { name?: string; description?: string; isActive?: boolean },
  ) {
    const niche = await this.repo.updateNiche(id, data);
    if (!niche) {
      throw new Error("Niche not found");
    }
    return { niche };
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
    const niche = await this.repo.updateNicheConfig(id, data);
    if (!niche) {
      throw new Error("Niche not found");
    }
    return { niche };
  }

  async deleteNiche(id: number) {
    const deleted = await this.repo.deleteNiche(id);
    if (!deleted) {
      throw new Error("Niche not found");
    }
    return { success: true };
  }

  async getNicheReels(
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
    const result = await this.repo.listNicheReels(nicheId, options);
    return result;
  }

  async dedupeNicheReels(nicheId: number) {
    const result = await this.repo.dedupeNicheReels(nicheId);
    return result;
  }

  async pingDatabase() {
    await this.repo.pingDatabase();
  }

  async queryAdminTablePage(params: {
    table: PgTable;
    whereClause: SQL | undefined;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    const [rows, total] = await Promise.all([
      this.repo.selectDynamicTableRows(
        params.table,
        params.whereClause,
        params.limit,
        offset,
      ),
      this.repo.countDynamicTableRows(params.table, params.whereClause),
    ]);
    return { rows, total };
  }

  async triggerNicheScrapeJob(nicheId: number) {
    const niche = await this.repo.findNicheForScrapeJob(nicheId);
    if (!niche) throw Errors.notFound("Niche");
    if (!niche.isActive) throw Errors.badRequest("Cannot scan inactive niche");
    const job = await this.repo.insertNicheScrapeJob({
      nicheId,
      limit: niche.scrapeLimit ?? 50,
      minViews: niche.scrapeMinViews ?? 1000,
      maxDaysOld: niche.scrapeMaxDaysOld ?? 30,
      viralOnly: niche.scrapeIncludeViralOnly ?? false,
    });
    return { jobId: job.id, message: "Scan job created" };
  }

  async createPlatformMusicTrack(params: {
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
    return this.repo.insertPlatformMusicTrack(params);
  }

  async prepareDeletePlatformMusicTrack(id: string) {
    const row = await this.repo.findMusicTrackForPlatformDelete(id);
    if (!row) throw Errors.notFound("Track");
    return row;
  }

  async finalizeDeletePlatformMusicTrack(trackId: string, assetId: string) {
    await this.repo.deletePlatformMusicTrackAndAsset(trackId, assetId);
  }

  findUserByFirebaseUid(firebaseUid: string) {
    return this.repo.findUserByFirebaseUid(firebaseUid);
  }

  countGenerationUsagesThisMonth(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.repo.countFeatureUsagesSince(
      userId,
      "generation",
      startOfMonth,
    );
  }
}
