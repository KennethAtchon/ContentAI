/**
 * Programmatic migration runner using drizzle-orm.
 * Used by the Docker startup script instead of drizzle-kit CLI,
 * which is a devDependency and may not be available at runtime.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  console.log("Running database migrations...");
  await migrate(db, {
    migrationsFolder: "src/infrastructure/database/drizzle/migrations",
  });
  console.log("Migrations completed successfully.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
