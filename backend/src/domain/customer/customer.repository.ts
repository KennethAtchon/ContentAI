import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  users,
  orders,
  featureUsages,
} from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface ICustomerRepository {
  // Profile operations
  getProfile(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    role: string;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null>;

  updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      timezone?: string;
    },
  ): Promise<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    role: string;
    timezone: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;

  // Usage operations
  getFeatureUsageCount(
    userId: string,
    featureType: string,
    since: Date,
  ): Promise<number>;

  // Order operations
  listOrders(
    userId: string,
    options: { skip: number; limit: number },
  ): Promise<
    {
      id: string;
      userId: string;
      totalAmount: string;
      status: string | null;
      stripeSessionId: string | null;
      skipPayment: boolean;
      orderType: string;
      isDeleted: boolean;
      createdAt: Date;
    }[]
  >;

  countOrders(userId: string): Promise<number>;

  getOrderById(
    userId: string,
    orderId: string,
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
  >;

  getOrderByStripeSessionId(
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
  >;

  createOrder(
    data: {
      userId: string;
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
  }>;

  getTotalRevenue(userId: string): Promise<string | null>;
}

export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly db: AppDb) {}

  async getProfile(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        address: users.address,
        role: users.role,
        timezone: users.timezone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)));

    return user ?? null;
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
  ) {
    const [updated] = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        address: users.address,
        role: users.role,
        timezone: users.timezone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      throw new Error("Failed to update profile");
    }

    return updated;
  }

  async getFeatureUsageCount(
    userId: string,
    featureType: string,
    since: Date,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(featureUsages)
      .where(
        and(
          eq(featureUsages.userId, userId),
          eq(featureUsages.featureType, featureType),
          gte(featureUsages.createdAt, since),
        ),
      );

    return result?.count ?? 0;
  }

  async listOrders(
    userId: string,
    options: { skip: number; limit: number },
  ) {
    return this.db
      .select({
        id: orders.id,
        userId: orders.userId,
        totalAmount: orders.totalAmount,
        status: orders.status,
        stripeSessionId: orders.stripeSessionId,
        skipPayment: orders.skipPayment,
        orderType: orders.orderType,
        isDeleted: orders.isDeleted,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .offset(options.skip)
      .limit(options.limit);
  }

  async countOrders(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.userId, userId));

    return result?.count ?? 0;
  }

  async getOrderById(userId: string, orderId: string) {
    const [order] = await this.db
      .select({
        id: orders.id,
        userId: orders.userId,
        totalAmount: orders.totalAmount,
        status: orders.status,
        stripeSessionId: orders.stripeSessionId,
        skipPayment: orders.skipPayment,
        orderType: orders.orderType,
        isDeleted: orders.isDeleted,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1);

    return order;
  }

  async getOrderByStripeSessionId(userId: string, stripeSessionId: string) {
    const [order] = await this.db
      .select({
        id: orders.id,
        userId: orders.userId,
        totalAmount: orders.totalAmount,
        status: orders.status,
        stripeSessionId: orders.stripeSessionId,
        skipPayment: orders.skipPayment,
        orderType: orders.orderType,
        isDeleted: orders.isDeleted,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.stripeSessionId, stripeSessionId),
          eq(orders.userId, userId),
        ),
      )
      .limit(1);

    return order;
  }

  async createOrder(
    data: {
      userId: string;
      totalAmount: string;
      status?: string;
      stripeSessionId?: string;
    },
  ) {
    const [order] = await this.db
      .insert(orders)
      .values({
        userId: data.userId,
        totalAmount: data.totalAmount,
        status: data.status ?? "completed",
        stripeSessionId: data.stripeSessionId,
      })
      .returning({
        id: orders.id,
        userId: orders.userId,
        totalAmount: orders.totalAmount,
        status: orders.status,
        stripeSessionId: orders.stripeSessionId,
        skipPayment: orders.skipPayment,
        orderType: orders.orderType,
        isDeleted: orders.isDeleted,
        createdAt: orders.createdAt,
      });

    if (!order) {
      throw new Error("Failed to create order");
    }

    return order;
  }

  async getTotalRevenue(userId: string): Promise<string | null> {
    const [result] = await this.db
      .select({ total: sql<string>`sum(total_amount)` })
      .from(orders)
      .where(
        and(eq(orders.userId, userId), eq(orders.status, "completed")),
      );

    return result?.total ?? null;
  }
}
