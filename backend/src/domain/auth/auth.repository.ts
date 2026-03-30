import { count, eq, isNotNull, sql } from "drizzle-orm";
import { users } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IAuthRepository {
  upsertUserOnLogin(params: {
    firebaseUid: string;
    email: string;
    name: string;
  }): Promise<{ id: string; email: string; role: string }>;

  setRoleAdminByFirebaseUid(firebaseUid: string): Promise<void>;

  /** Lightweight read so health checks can verify the users table is reachable. */
  pingUsersTable(): Promise<void>;

  /** Raw driver round-trip + ORM read — used by `GET /api/health` database check. */
  pingDatabaseForHealth(): Promise<void>;

  /** Users linked to Firebase (bulk admin sync to Auth). */
  listUsersWithFirebaseUid(): Promise<
    Array<{
      firebaseUid: string;
      email: string;
      name: string | null;
      isActive: boolean | null;
      role: string;
    }>
  >;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly db: AppDb) {}

  async upsertUserOnLogin(params: {
    firebaseUid: string;
    email: string;
    name: string;
  }): Promise<{ id: string; email: string; role: string }> {
    const [user] = await this.db
      .insert(users)
      .values({
        firebaseUid: params.firebaseUid,
        email: params.email,
        name: params.name,
        role: "user",
        isActive: true,
        timezone: "UTC",
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: {
          email: params.email,
          name: params.name,
          lastLogin: new Date(),
        },
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    if (!user) {
      throw new Error("Failed to upsert user on login");
    }
    return user;
  }

  async setRoleAdminByFirebaseUid(firebaseUid: string): Promise<void> {
    await this.db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.firebaseUid, firebaseUid));
  }

  async pingUsersTable(): Promise<void> {
    await this.db.select({ cnt: count() }).from(users).limit(1);
  }

  async pingDatabaseForHealth(): Promise<void> {
    await this.db.execute(sql`SELECT 1 as health_check`);
    await this.pingUsersTable();
  }

  async listUsersWithFirebaseUid() {
    const rows = await this.db
      .select({
        firebaseUid: users.firebaseUid,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        role: users.role,
      })
      .from(users)
      .where(isNotNull(users.firebaseUid));

    const out: Array<{
      firebaseUid: string;
      email: string;
      name: string | null;
      isActive: boolean | null;
      role: string;
    }> = [];
    for (const r of rows) {
      if (!r.firebaseUid) continue;
      out.push({
        firebaseUid: r.firebaseUid,
        email: r.email,
        name: r.name,
        isActive: r.isActive,
        role: r.role,
      });
    }
    return out;
  }
}
