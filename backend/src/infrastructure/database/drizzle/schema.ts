import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  json,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firebaseUid: text("firebase_uid").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  timezone: text("timezone").default("UTC"),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  lastLogin: timestamp("last_login"),
  hasUsedFreeTrial: boolean("has_used_free_trial").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const orders = pgTable(
  "order",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: text("status"),
    stripeSessionId: text("stripe_session_id").unique(),
    skipPayment: boolean("skip_payment").notNull().default(false),
    orderType: text("order_type").notNull().default("one_time"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("orders_user_id_idx").on(t.userId)],
);

export const contactMessages = pgTable("contact_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const featureUsages = pgTable(
  "feature_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    featureType: text("feature_type").notNull(),
    inputData: json("input_data").notNull(),
    resultData: json("result_data").notNull(),
    usageTimeMs: integer("usage_time_ms").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("feature_usages_user_id_idx").on(t.userId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  featureUsages: many(featureUsages),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const featureUsagesRelations = relations(featureUsages, ({ one }) => ({
  user: one(users, { fields: [featureUsages.userId], references: [users.id] }),
}));

// ─── Inferred types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type FeatureUsage = typeof featureUsages.$inferSelect;
export type NewFeatureUsage = typeof featureUsages.$inferInsert;
