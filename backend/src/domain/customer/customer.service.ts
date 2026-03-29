import type { ICustomerRepository } from "./customer.repository";
import { Errors } from "../../utils/errors/app-error";

export interface UsageStats {
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number;
  contentGenerated: number;
  contentGeneratedLimit: number;
  queueSize: number;
  queueLimit: null;
  tier: string;
  resetDate: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: string;
  timezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerService {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async getUsageStats(
    userId: string,
    stripeRole: string | null,
    queueSize: number,
    limits: { analysis: number; generation: number },
  ): Promise<UsageStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [analysesCount, generationsCount] = await Promise.all([
      this.customerRepo.getFeatureUsageCount(
        userId,
        "reel_analysis",
        monthStart,
      ),
      this.customerRepo.getFeatureUsageCount(userId, "generation", monthStart),
    ]);

    return {
      reelsAnalyzed: analysesCount,
      reelsAnalyzedLimit: limits.analysis,
      contentGenerated: generationsCount,
      contentGeneratedLimit: limits.generation,
      queueSize,
      queueLimit: null,
      tier: stripeRole ?? "free",
      resetDate: resetDate.toISOString(),
    };
  }

  async getProfile(userId: string): Promise<CustomerProfile> {
    const user = await this.customerRepo.getProfile(userId);
    if (!user) {
      throw Errors.notFound("User");
    }
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      timezone?: string;
    },
  ): Promise<CustomerProfile> {
    return this.customerRepo.updateProfile(userId, data);
  }

  async listOrders(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<{
    orders: {
      id: string;
      userId: string;
      totalAmount: string;
      status: string | null;
      stripeSessionId: string | null;
      skipPayment: boolean;
      orderType: string;
      isDeleted: boolean;
      createdAt: Date;
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (options.page - 1) * options.limit;

    const [orders, total] = await Promise.all([
      this.customerRepo.listOrders(userId, { skip, limit: options.limit }),
      this.customerRepo.countOrders(userId),
    ]);

    return {
      orders,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }

  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<{
    id: string;
    userId: string;
    totalAmount: string;
    status: string | null;
    stripeSessionId: string | null;
    skipPayment: boolean;
    orderType: string;
    isDeleted: boolean;
    createdAt: Date;
  }> {
    const order = await this.customerRepo.getOrderById(userId, orderId);
    if (!order) {
      throw Errors.notFound("Order");
    }
    return order;
  }

  async getOrderByStripeSessionId(
    userId: string,
    stripeSessionId: string,
  ): Promise<
    | {
        id: string;
        userId: string;
        totalAmount: string;
        status: string | null;
        stripeSessionId: string | null;
        skipPayment: boolean;
        orderType: string;
        isDeleted: boolean;
        createdAt: Date;
      }
    | undefined
  > {
    return this.customerRepo.getOrderByStripeSessionId(
      userId,
      stripeSessionId,
    );
  }

  async createOrderFromCheckout(
    userId: string,
    data: {
      totalAmount: string;
      status?: string;
      stripeSessionId?: string;
    },
  ): Promise<{
    id: string;
    userId: string;
    totalAmount: string;
    status: string | null;
    stripeSessionId: string | null;
    skipPayment: boolean;
    orderType: string;
    isDeleted: boolean;
    createdAt: Date;
  }> {
    return this.customerRepo.createOrder({
      userId,
      totalAmount: data.totalAmount,
      status: data.status,
      stripeSessionId: data.stripeSessionId,
    });
  }

  async createOrder(
    userId: string,
    data: {
      totalAmount: string;
      status?: string;
      stripeSessionId?: string;
    },
  ): Promise<{
    id: string;
    userId: string;
    totalAmount: string;
    status: string | null;
    stripeSessionId: string | null;
    skipPayment: boolean;
    orderType: string;
    isDeleted: boolean;
    createdAt: Date;
  }> {
    return this.customerRepo.createOrder({
      userId,
      totalAmount: data.totalAmount,
      status: data.status ?? "pending",
      stripeSessionId: data.stripeSessionId,
    });
  }

  async getTotalRevenue(userId: string): Promise<string> {
    const total = await this.customerRepo.getTotalRevenue(userId);
    return total ?? "0";
  }

  recordFeatureUsage(
    userId: string,
    featureType: "generation" | "reel_analysis",
    inputData: Record<string, unknown> = {},
    resultData: Record<string, unknown> = {},
  ) {
    return this.customerRepo.insertFeatureUsage({
      userId,
      featureType,
      inputData,
      resultData,
    });
  }
}
