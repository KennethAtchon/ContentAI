# Database ORM/Query Layer Alternatives to Prisma

> Research doc — context: Hono + Bun runtime + PostgreSQL

---

## Why Consider Alternatives

- **Prisma v6 removed `Prisma.dmmf`** from the public API, breaking runtime schema introspection
- Prisma generates a heavy client (~2–5MB) at build time; cold start matters on edge/serverless
- The Prisma client is not a real SQL query builder — complex queries require raw SQL fallback
- Schema migrations live in a separate mental model (`.prisma` file + `prisma migrate`) which can feel like extra overhead

---

## Candidates

### 1. Drizzle ORM

**Website:** https://orm.drizzle.team
**npm:** `drizzle-orm` + `drizzle-kit`

#### What it is
TypeScript-first ORM with a SQL-like query builder API. Schema is defined in TypeScript, no separate DSL file. The Prisma-to-Drizzle migration is the most common path right now.

#### API feel
```ts
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

// SELECT
const user = await db.select().from(users).where(eq(users.email, email));

// INSERT
await db.insert(users).values({ name, email });

// UPDATE
await db.update(users).set({ role: "admin" }).where(eq(users.id, id));
```

Schema is plain TypeScript:
```ts
export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

#### Migrations
`drizzle-kit generate` + `drizzle-kit migrate` — outputs plain `.sql` files you can inspect and commit.

#### Pros
- Excellent Bun support (first-class)
- No code generation step needed at runtime — types come from your schema file directly
- Tiny bundle; no binary engine
- SQL-like API means the mental model stays close to actual SQL
- `drizzle-kit studio` for GUI (similar to Prisma Studio)
- No DMMF, no magic — schema introspection is just reading your TypeScript

#### Cons
- Relations API is less ergonomic than Prisma (`include:` vs manual joins or `with:`)
- Newer ecosystem — some edge cases have less StackOverflow coverage
- No built-in soft-delete, no middleware system (must roll your own)
- Migration history tracking is simpler than Prisma's (no shadow database)

#### Migration effort from Prisma
**Medium.** Schema rewrite to TypeScript + update all queries. Types are equivalent so it's mostly mechanical. Tools like `prisma-to-drizzle` can automate part of the schema conversion. Estimated effort for this codebase: ~1–2 days.

---

### 2. Kysely

**Website:** https://kysely.dev
**npm:** `kysely`

#### What it is
A type-safe SQL *query builder*, not an ORM. No schema definition, no migrations — purely for building and running queries with full type safety derived from a database type you define.

#### API feel
```ts
const user = await db
  .selectFrom("user")
  .where("email", "=", email)
  .selectAll()
  .executeTakeFirst();

await db.insertInto("user").values({ name, email }).execute();
```

Types come from a manually maintained `Database` interface:
```ts
interface Database {
  user: { id: string; email: string; role: string; created_at: Date };
  order: { id: string; user_id: string; total_amount: number };
}
```

Alternatively, you can use `kysely-codegen` to auto-generate the `Database` interface by introspecting a live database.

#### Pros
- Absolutely minimal — no runtime overhead, no codegen required
- SQL is transparent; what you write is almost exactly what runs
- Works perfectly with Bun + `pg` driver
- Great for teams that know SQL well and want types without ORM magic

#### Cons
- You manage migrations separately (use `node-pg-migrate`, raw SQL files, or pair with Drizzle Kit)
- Relation loading is manual (no `include:` equivalent — write a JOIN)
- Database type interface must be maintained by hand (or regenerated via `kysely-codegen`)
- More boilerplate than Prisma for CRUD operations

#### Migration effort from Prisma
**High for migrations** (need a separate migration tool), **medium for queries** (rewrite query calls). Good choice if the team wants to "drop down" closer to SQL.

---

### 3. postgres.js (raw driver)

**Website:** https://github.com/porsager/postgres
**npm:** `postgres`

#### What it is
A fast, modern PostgreSQL client for Node.js/Bun with tagged template literals for safe parameterized queries. No query builder, no ORM, no types beyond what you annotate yourself.

#### API feel
```ts
import postgres from "postgres";
const sql = postgres(DATABASE_URL);

const [user] = await sql`SELECT * FROM "user" WHERE email = ${email}`;
await sql`INSERT INTO "user" ${sql({ name, email, role: "user" })}`;
```

#### Pros
- Fastest possible PostgreSQL client for Bun (benchmarks consistently top)
- Zero overhead, zero abstraction — SQL is SQL
- Template literal API prevents SQL injection safely
- Tiny dependency

#### Cons
- No type safety without manual annotations or a codegen layer
- No schema definition, no migrations
- No relation loading helpers
- Appropriate only if the team is very comfortable writing raw SQL for everything

#### Migration effort from Prisma
**Very high.** Every query must be rewritten as raw SQL. Schema must be managed entirely separately. Only recommend if dropping ORM entirely is an intentional architectural decision.

---

## Comparison Table

| | Prisma 6 | Drizzle | Kysely | postgres.js |
|---|---|---|---|---|
| **Type safety** | Excellent | Excellent | Excellent | Manual |
| **Schema definition** | `.prisma` DSL | TypeScript | Manual interface | None |
| **Migrations** | `prisma migrate` | `drizzle-kit` | Separate tool | Separate tool |
| **Query builder** | Prisma Client API | SQL-like TS | SQL-like TS | Tagged template |
| **Relation loading** | `include:` (excellent) | `with:` (good) | Manual JOINs | Manual JOINs |
| **Bundle size** | Heavy (+ binary engine) | Tiny | Tiny | Tiny |
| **Bun support** | Good (some quirks) | First-class | Good | First-class |
| **Runtime schema introspection** | Broken in v6 | N/A — TS types | N/A — TS types | N/A |
| **Codegen required** | Yes (`prisma generate`) | No | Optional | No |
| **Studio/GUI** | Prisma Studio | Drizzle Studio | None built-in | None |
| **Ecosystem maturity** | Very mature | Growing fast | Stable | Very mature |
| **Migration effort** | — | Medium | High | Very high |

---

## Recommendation

**Drizzle ORM** is the clear best fit for this stack given:

1. **Eliminates the DMMF problem** — schema is TypeScript, introspection is just reading types at compile time, not runtime magic
2. **First-class Bun support** — no binary engine, works out of the box
3. **Closest to Prisma conceptually** — schema definition + migrations + query builder, just lighter and more transparent
4. **The `/api/admin/schema` endpoint becomes unnecessary** — the developer page could derive field info from the Drizzle schema TypeScript file at build time instead

If the team wants to move even closer to SQL and is comfortable with manual joins, **Kysely** is a solid runner-up. Use `kysely-codegen` to keep the types in sync with the live database.

---

## Migration Path (Prisma → Drizzle)

1. Install: `bun add drizzle-orm postgres` + `bun add -d drizzle-kit`
2. Convert `schema.prisma` → Drizzle table definitions in `src/infrastructure/database/schema.ts`
3. Configure `drizzle.config.ts` pointing at the existing PostgreSQL database
4. Run `drizzle-kit generate` to produce SQL migrations from the new schema (or `drizzle-kit introspect` to generate schema from the existing DB)
5. Replace `prisma` client imports with Drizzle `db` instance
6. Rewrite queries (CRUD is straightforward; relation loading needs `with:` or explicit joins)
7. Remove `prisma generate` from dev startup script

Key Prisma → Drizzle query mappings:
```ts
// Prisma
prisma.user.findMany({ where: { role: "user" }, take: 20 })
// Drizzle
db.select().from(users).where(eq(users.role, "user")).limit(20)

// Prisma
prisma.user.findUnique({ where: { id } })
// Drizzle
db.select().from(users).where(eq(users.id, id)).then(r => r[0])

// Prisma
prisma.user.create({ data: { name, email } })
// Drizzle
db.insert(users).values({ name, email }).returning()

// Prisma
prisma.user.update({ where: { id }, data: { role: "admin" } })
// Drizzle
db.update(users).set({ role: "admin" }).where(eq(users.id, id))
```
