import {
  getMonthBoundaries,
  calculatePercentChange,
} from "../../utils/helpers/date";
import { formatOrderResponse } from "../../utils/helpers/order-helpers";
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
}
