import type { IUsersRepository } from "./users.repository";
import { Errors } from "../../utils/errors/app-error";

export class UsersService {
  constructor(private readonly usersRepo: IUsersRepository) {}

  async listUsers(options: {
    page: number;
    limit: number;
    search?: string;
    includeDeleted: boolean;
  }) {
    const { users, total } = await this.usersRepo.listUsers(options);
    const totalPages = Math.ceil(total / options.limit);

    return {
      users,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasMore: options.page < totalPages,
        hasPrevious: options.page > 1,
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw Errors.notFound("User");
    }
    return user;
  }

  async createUser(data: {
    name: string;
    email: string;
    firebaseUid?: string | null;
    timezone?: string;
  }) {
    return this.usersRepo.createUser({
      ...data,
      role: "user",
    });
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
    // Verify user exists
    await this.getUserById(id);

    return this.usersRepo.updateUser(id, data);
  }

  async deleteUser(id: string, hardDelete: boolean) {
    // Verify user exists
    const user = await this.getUserById(id);

    await this.usersRepo.deleteUser(id, hardDelete);

    return {
      success: true,
      message: hardDelete ? "User deleted permanently" : "User deactivated",
      firebaseUid: user.firebaseUid,
    };
  }

  async getCustomerStats() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(startOfThisMonth.getTime() - 1);

    const stats = await this.usersRepo.getCustomerStats({
      startOfThisMonth,
      startOfLastMonth,
      endOfLastMonth,
      now,
    });

    let percentChange = 0;
    if (stats.lastMonthCustomers > 0) {
      percentChange =
        ((stats.thisMonthCustomers - stats.lastMonthCustomers) /
          stats.lastMonthCustomers) *
        100;
    } else if (stats.thisMonthCustomers > 0) {
      percentChange = 100;
    }

    return {
      ...stats,
      percentChange,
    };
  }

  async deleteOwnAccount(firebaseUid: string) {
    const user = await this.usersRepo.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw Errors.notFound("User");
    }

    await this.usersRepo.softDeleteUser(user.id);

    return { success: true, message: "Account deleted successfully" };
  }

  async exportUserData(userId: string) {
    const [user, orders] = await Promise.all([
      this.usersRepo.findById(userId),
      this.usersRepo.getUserOrders(userId),
    ]);

    if (!user) {
      throw Errors.notFound("User");
    }

    const exportData = {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      orders,
    };

    return exportData;
  }

  async objectToProcessing(userId: string) {
    // Verify user exists
    await this.getUserById(userId);

    return this.usersRepo.updateUser(userId, { isActive: false });
  }
}
