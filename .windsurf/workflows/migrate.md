---
description: Database migration workflow for schema changes
---

# Database Migration Workflow

This workflow handles database schema changes safely and systematically.

## Migration Types

### Schema Changes
- Adding new tables
- Modifying existing tables
- Adding/removing columns
- Creating indexes
- Adding constraints

### Data Changes
- Data transformations
- Data cleanup
- Seeding initial data
- Backfilling new columns

## Migration Process

### 1. Schema Changes
```bash
# Navigate to backend directory
cd backend

# Generate migration from schema changes
bun db:generate

# Review generated migration file
# File will be in: src/infrastructure/database/drizzle/migrations/
```

### 2. Review Migration
- Check the generated SQL in the migration file
- Ensure data integrity is maintained
- Verify rollback operations are safe
- Test migration on staging database

### 3. Apply Migration
```bash
# Apply pending migrations
bun db:migrate

# Verify migration status
bun db:migrate --status
```

### 4. Update Types
- Update TypeScript types if schema changed
- Regenerate Drizzle client types
- Update service layer code

## Schema Modification Guidelines

### Adding New Tables
```typescript
// In src/infrastructure/database/drizzle/schema.ts
export const newTable = pgTable('new_table', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

### Adding Columns
```typescript
// Add to existing table definition
export const existingTable = pgTable('existing_table', {
  // ... existing columns
  newColumn: text('new_column'), // Add nullable column first
})
```

### Modifying Columns
```typescript
// For type changes, create new column and migrate data
// Then drop old column in separate migration
```

## Data Migration Patterns

### Safe Data Transformations
```typescript
// Migration file example
export async function up(db: PgDatabase) {
  // Add new column
  await db.execute(sql`ALTER TABLE users ADD COLUMN new_field TEXT`)
  
  // Migrate data safely
  await db.execute(sql`
    UPDATE users 
    SET new_field = COALESCE(old_field, 'default_value')
  `)
  
  // Add constraint after data is migrated
  await db.execute(sql`ALTER TABLE users ALTER COLUMN new_field SET NOT NULL`)
}
```

### Rollback Operations
```typescript
export async function down(db: PgDatabase) {
  // Reverse operations in safe order
  await db.execute(sql`ALTER TABLE users DROP COLUMN new_field`)
}
```

## Testing Migrations

### Local Testing
```bash
# Use local test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"

# Run migration on test database
bun db:migrate

# Verify results with db studio
bun db:studio
```

### Staging Testing
- Test on staging environment first
- Verify data integrity after migration
- Test rollback procedures
- Check application compatibility

## Production Deployment

### Pre-deployment Checks
- [ ] Migration tested on staging
- [ ] Rollback procedure documented
- [ ] Database backup created
- [ ] Application downtime planned if needed

### Deployment Steps
1. Create database backup
2. Put application in maintenance mode (if needed)
3. Apply migration
4. Verify migration success
5. Update application
6. Remove maintenance mode
7. Monitor application health

### Post-deployment
- Monitor application performance
- Check for any errors
- Verify data integrity
- Update documentation

## Common Migration Scenarios

### Adding New Feature Table
```typescript
// 1. Define table in schema
export const featureSettings = pgTable('feature_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  setting: text('setting').notNull(),
  value: text('value').notNull(),
})

// 2. Generate migration
bun db:generate

// 3. Apply migration
bun db:migrate
```

### Backfilling Data
```typescript
export async function up(db: PgDatabase) {
  // Add column as nullable
  await db.execute(sql`ALTER TABLE users ADD COLUMN new_status TEXT`)
  
  // Backfill data in batches for large tables
  const batchSize = 1000
  let offset = 0
  
  while (true) {
    const result = await db.execute(sql`
      UPDATE users 
      SET new_status = 'active'
      WHERE id BETWEEN ${offset} AND ${offset + batchSize}
      AND new_status IS NULL
    `)
    
    if (result.rowCount === 0) break
    offset += batchSize
  }
  
  // Make column non-nullable
  await db.execute(sql`ALTER TABLE users ALTER COLUMN new_status SET NOT NULL`)
}
```

## Troubleshooting

### Common Issues
- **Lock timeouts**: Break large migrations into smaller batches
- **Memory issues**: Use cursors for large data operations
- **Constraint violations**: Check data before adding constraints

### Recovery Procedures
```bash
# Rollback to specific migration
bun db:migrate --revert

# Reset database (development only)
bun db:reset

# Check migration status
bun db:migrate --status
```

## Best Practices

- Always test migrations on staging first
- Use transactions for related operations
- Break large migrations into smaller steps
- Document complex migrations
- Keep migrations reversible
- Monitor production migrations closely

// turbo: Generate and apply migrations automatically when safe