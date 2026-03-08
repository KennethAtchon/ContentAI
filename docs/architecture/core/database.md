# Database & Validation

## Overview

PostgreSQL database with Prisma ORM, Zod validation, and security best practices.

**Stack:**
- **Database:** PostgreSQL
- **ORM:** Prisma (type-safe queries)
- **Validation:** Zod schemas
- **Connection Pooling:** Prisma connection pool
- **Migrations:** Prisma migrate (`bun db:migrate` from `backend/`)

---

## Table of Contents

1. [Schema Design](#schema-design)
2. [Prisma Client](#prisma-client)
3. [Query Patterns](#query-patterns)
4. [Data Validation](#data-validation)
5. [Best Practices](#best-practices)

---

## Schema Design

**Location:** `backend/src/infrastructure/database/prisma/schema.prisma`

### Example Schema

```prisma
model User {
  id       String   @id // Firebase UID
  email    String   @unique
  name     String?
  role     String   @default("user")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean  @default(false)
  deletedAt DateTime?
  
  // Relations
  orders   Order[]
  
  @@index([email])
  @@index([role])
  @@map("users")
}

model Order {
  id          String   @id @default(uuid())
  userId      String
  totalAmount Decimal  @db.Decimal(10, 2)
  status      String   @default("pending")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  isDeleted   Boolean  @default(false)
  
  // Relations
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([status])
  @@map("orders")
}
```

### Design Patterns

- **Soft Deletes:** `isDeleted` + `deletedAt` fields
- **Timestamps:** `createdAt` + `updatedAt` (automatic)
- **Indexes:** On frequently queried fields
- **Relations:** Clear foreign key relationships

---

## Prisma Client

**Location:** `backend/src/infrastructure/database/lib/generated/prisma/`

### Client Configuration

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

### Connection Pooling

Prisma handles connection pooling automatically. For serverless:

```typescript
// Recommended for serverless (Vercel, etc.)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // For migrations
}
```

---

## Query Patterns

### Basic CRUD

```typescript
import prisma from '@/shared/services/db/prisma'

// Create
const user = await prisma.user.create({
  data: {
    id: firebaseUid,
    email: 'user@example.com',
    name: 'John Doe',
  }
})

// Read
const user = await prisma.user.findUnique({
  where: { id: userId }
})

// Update
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: 'Jane Doe' }
})

// Delete (soft delete)
const deleted = await prisma.user.update({
  where: { id: userId },
  data: { 
    isDeleted: true,
    deletedAt: new Date()
  }
})
```

### Query with Relations

```typescript
// Include related data
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    orders: true,  // Include all orders
  }
})

// Select specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
  }
})
```

### Pagination

```typescript
const page = 1
const limit = 20
const skip = (page - 1) * limit

const [users, totalCount] = await Promise.all([
  prisma.user.findMany({
    where: { isDeleted: false },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.user.count({
    where: { isDeleted: false },
  }),
])

const totalPages = Math.ceil(totalCount / limit)
```

### Filtering & Searching

```typescript
const users = await prisma.user.findMany({
  where: {
    AND: [
      { isDeleted: false },
      { role: 'user' },
      {
        OR: [
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
    ],
  },
})
```

### Transactions

```typescript
await prisma.$transaction(async (tx) => {
  // Update user
  await tx.user.update({
    where: { id: userId },
    data: { /* ... */ },
  })
  
  // Create order
  await tx.order.create({
    data: { /* ... */ },
  })
})
```

---

## Data Validation

**Location:** `frontend/src/shared/utils/validation/` (frontend) and `backend/src/` (backend)

### Zod Schema Definition

```typescript
import { z } from 'zod'

// Define schema
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100),
  age: z.number().int().min(0).max(150).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
```

### API Validation

```typescript
import { createUserSchema } from '@/shared/utils/validation/api-validation'

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // Validate input
  const result = createUserSchema.safeParse(body)
  
  if (!result.success) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: result.error.issues
      },
      { status: 422 }
    )
  }
  
  const validData = result.data  // Type-safe
  
  // Use validData...
}
```

### Common Validation Patterns

```typescript
// Email validation
z.string().email()

// Required string
z.string().min(1, 'Field is required')

// Optional field
z.string().optional()

// Number range
z.number().min(0).max(100)

// Enum
z.enum(['user', 'admin'])

// Custom validation
z.string().refine((val) => val.length > 0, {
  message: 'Custom error message'
})

// Transform
z.string().transform((val) => val.toLowerCase())
```

---

## Best Practices

### Security

- ✅ Use Prisma (prevents SQL injection)
- ✅ Never concatenate user input into queries
- ✅ Validate all inputs with Zod
- ✅ Sanitize error messages (no sensitive data)

### Performance

- ✅ Use indexes on frequently queried fields
- ✅ Select only needed fields
- ✅ Use pagination for large datasets
- ✅ Batch queries when possible

### Data Integrity

- ✅ Use transactions for related operations
- ✅ Implement soft deletes
- ✅ Use database constraints (unique, foreign keys)
- ✅ Add timestamps to track changes

### Error Handling

- ✅ Handle Prisma errors gracefully
- ✅ Log database errors server-side
- ✅ Return user-friendly error messages
- ✅ Use try-catch blocks

---

## Related Documentation

- [API Architecture](./api.md) - API routes
- [Security](./security.md) - Input validation, PII sanitization
- [Error Handling](./error-handling.md) - Error patterns

---

*Last Updated: January 2026*
