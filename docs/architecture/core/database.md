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
  orders            Order[]
  generatedContent  GeneratedContent[]
  queueItems        QueueItem[]
  
  @@index([email])
  @@index([role])
  @@map("users")
}

model Reel {
  id              String   @id @default(uuid())
  username        String
  niche           String
  contentUrl      String?
  thumbnailEmoji String?
  hook            String
  caption         String?
  audioTrack      String?
  views           BigInt
  likes           BigInt
  comments        BigInt
  engagementRate  Decimal  @db.Decimal(8, 5)
  postedAt        DateTime
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean  @default(false)
  
  // Relations
  analysis         ReelAnalysis?
  generatedContent GeneratedContent[]
  
  @@index([niche])
  @@index([engagementRate])
  @@index([postedAt])
  @@index([username])
  @@map("reels")
}

model ReelAnalysis {
  id                String   @id @default(uuid())
  reelId            String   @unique
  hookPattern       String
  hookCategory      String
  emotionalTrigger  String
  formatPattern     String
  ctaType           String
  captionFramework  String
  curiosityGapStyle String
  remixSuggestion   String
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  reel Reel @relation(fields: [reelId], references: [id])
  
  @@map("reel_analyses")
}

model GeneratedContent {
  id               String   @id @default(uuid())
  userId           String
  sourceReelId      String
  prompt           String
  outputType       String   // 'full' | 'hook' | 'caption'
  generatedHook    String
  generatedCaption String
  generatedScript  String?
  status           String   @default("draft") // 'draft' | 'queued' | 'posted'
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean  @default(false)
  
  // Relations
  user        User     @relation(fields: [userId], references: [id])
  sourceReel  Reel     @relation(fields: [sourceReelId], references: [id])
  queueItems  QueueItem[]
  
  @@index([userId])
  @@index([sourceReelId])
  @@index([status])
  @@map("generated_content")
}

model QueueItem {
  id            String    @id @default(uuid())
  userId        String
  contentId     String
  status        String    @default("queued") // 'queued' | 'scheduled' | 'posted' | 'failed'
  scheduledFor  DateTime?
  postedAt      DateTime?
  instagramPostId String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean  @default(false)
  
  // Relations
  user    User            @relation(fields: [userId], references: [id])
  content GeneratedContent @relation(fields: [contentId], references: [id])
  
  @@index([userId])
  @@index([contentId])
  @@index([status])
  @@index([scheduledFor])
  @@map("queue_items")
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

### Studio-specific Queries

```typescript
// Get reels with analysis for a niche
const reels = await prisma.reel.findMany({
  where: {
    niche: 'fitness',
    isDeleted: false
  },
  include: {
    analysis: true
  },
  orderBy: {
    engagementRate: 'desc'
  },
  take: 20
});

// Get user's generation history
const generations = await prisma.generatedContent.findMany({
  where: {
    userId: user.id,
    isDeleted: false
  },
  include: {
    sourceReel: {
      select: {
        id: true,
        username: true,
        hook: true,
        thumbnailEmoji: true
      }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20
});

// Get user's queue with content
const queue = await prisma.queueItem.findMany({
  where: {
    userId: user.id,
    isDeleted: false
  },
  include: {
    content: {
      include: {
        sourceReel: {
          select: {
            username: true,
            hook: true
          }
        }
      }
    }
  },
  orderBy: { scheduledFor: 'asc' }
});
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

### Studio-specific Validation

```typescript
// Reel discovery validation
export const reelDiscoverySchema = z.object({
  niche: z.string().min(1).max(50),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

// Generation request validation
export const generationRequestSchema = z.object({
  sourceReelId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
  outputType: z.enum(['full', 'hook', 'caption'])
});

// Queue item validation
export const queueItemSchema = z.object({
  contentId: z.string().uuid(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(['queued', 'scheduled', 'posted', 'failed']).optional()
});

// Analysis response validation
export const reelAnalysisSchema = z.object({
  hookPattern: z.string(),
  hookCategory: z.string(),
  emotionalTrigger: z.string(),
  formatPattern: z.string(),
  ctaType: z.string(),
  captionFramework: z.string(),
  curiosityGapStyle: z.string(),
  remixSuggestion: z.string()
});
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
- [Studio System](../domain/studio-system.md) - Studio-specific database patterns
- [Generation System](../domain/generation-system.md) - Content generation data flow

---

*Last Updated: January 2026*
