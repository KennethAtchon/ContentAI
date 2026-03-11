#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
#  db-reset.sh — Drop all tables, wipe migrations, regenerate
# ───────────────────────────────────────────────────────────
#  Usage:  cd backend && bash scripts/db-reset.sh
# ───────────────────────────────────────────────────────────
set -euo pipefail

MIGRATIONS_DIR="./src/infrastructure/database/drizzle/migrations"

echo ""
echo "⚠️  This will DROP ALL TABLES and reset migrations to 0."
echo "    Database: \$DATABASE_URL"
echo ""
read -rp "Are you sure? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# 1. Drop all tables in the public schema
echo ""
echo "🗑️  Dropping all tables..."
bun -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);

const tables = await sql\`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
\`;

if (tables.length === 0) {
  console.log('   No tables to drop.');
} else {
  const names = tables.map(t => '\"' + t.tablename + '\"').join(', ');
  console.log('   Dropping:', names);
  await sql.unsafe('DROP TABLE IF EXISTS ' + names + ' CASCADE');
  console.log('   ✅ All tables dropped.');
}

await sql.end();
"

# 2. Remove existing migrations folder
echo ""
echo "🧹  Removing migrations directory..."
rm -rf "$MIGRATIONS_DIR"
echo "   ✅ Removed $MIGRATIONS_DIR"

# 3. Regenerate fresh migration from current schema
echo ""
echo "📦  Generating fresh migration from schema..."
bunx drizzle-kit generate
echo ""
echo "✅  Done! Fresh migration created in $MIGRATIONS_DIR"

# 4. Apply it
echo ""
read -rp "Apply the migration now? (y/N) " apply
if [[ "$apply" == "y" || "$apply" == "Y" ]]; then
  echo "🚀  Pushing schema to database..."
  bunx drizzle-kit push
  echo "✅  Schema pushed!"
else
  echo "ℹ️  Run 'bun run db:push' or 'bun run db:migrate' when ready."
fi

echo ""
echo "🎉  Migration reset complete."
