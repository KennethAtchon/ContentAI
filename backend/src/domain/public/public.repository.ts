import { and, desc, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../database.types";
import { contactMessages } from "../../infrastructure/database/drizzle/schema";
import type { ContactMessage } from "../../infrastructure/database/drizzle/schema";

export type ContactMessageListFilter = {
  limit: number;
  offset: number;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export interface IPublicRepository {
  listContactMessagesPage(
    filter: ContactMessageListFilter,
  ): Promise<{ rows: ContactMessage[]; total: number }>;
  insertContactMessage(values: {
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
  }): Promise<{ id: string; createdAt: Date }>;
}

export class PublicRepository implements IPublicRepository {
  constructor(private readonly db: AppDb) {}

  private contactMessageWhereClause(
    filter: Omit<ContactMessageListFilter, "limit" | "offset">,
  ): SQL | undefined {
    const conditions: SQL[] = [];
    if (filter.search) {
      const term = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(contactMessages.name, term),
          ilike(contactMessages.email, term),
          ilike(contactMessages.subject, term),
        )!,
      );
    }
    if (filter.dateFrom) {
      conditions.push(gte(contactMessages.createdAt, filter.dateFrom));
    }
    if (filter.dateTo) {
      conditions.push(lte(contactMessages.createdAt, filter.dateTo));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async listContactMessagesPage(
    filter: ContactMessageListFilter,
  ): Promise<{ rows: ContactMessage[]; total: number }> {
    const { limit, offset, ...rest } = filter;
    const whereClause = this.contactMessageWhereClause(rest);

    const listBase = this.db.select().from(contactMessages);
    const countBase = this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(contactMessages);

    const [rawMessages, countRows] = await Promise.all([
      whereClause
        ? listBase
            .where(whereClause)
            .orderBy(desc(contactMessages.createdAt))
            .limit(limit)
            .offset(offset)
        : listBase
            .orderBy(desc(contactMessages.createdAt))
            .limit(limit)
            .offset(offset),
      whereClause ? countBase.where(whereClause) : countBase,
    ]);

    const total = countRows[0]?.total ?? 0;
    return { rows: rawMessages, total };
  }

  async insertContactMessage(values: {
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
  }): Promise<{ id: string; createdAt: Date }> {
    const [row] = await this.db
      .insert(contactMessages)
      .values(values)
      .returning({
        id: contactMessages.id,
        createdAt: contactMessages.createdAt,
      });
    if (!row) throw new Error("Failed to insert contact message");
    return row;
  }
}
