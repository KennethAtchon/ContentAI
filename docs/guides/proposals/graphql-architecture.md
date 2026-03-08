# GraphQL Architecture - Core Architecture

## Overview

GraphQL integration options for Next.js App Router with comprehensive protection layers and migration strategies.

**Key Features:**
- Apollo Server integration
- Type-safe GraphQL schemas
- Authentication & authorization
- Rate limiting & CSRF protection
- Coexistence with REST APIs

---

## Table of Contents

1. [Why GraphQL?](#why-graphql)
2. [Next.js Integration Options](#nextjs-integration-options)
3. [Apollo Server Setup](#apollo-server-setup)
4. [Schema Design](#schema-design)
5. [Authentication & Authorization](#authentication--authorization)
6. [Migration Strategy](#migration-strategy)
7. [Hybrid Approach](#hybrid-approach)
8. [Best Practices](#best-practices)

---

## Why GraphQL?

### Advantages

**1. Flexible Data Fetching**
```graphql
# Client requests exactly what it needs
query GetUser {
  user(id: "123") {
    name
    email
    orders {
      id
      total
      items {
        name
        price
      }
    }
  }
}
```

**2. Reduced Over-fetching**
- REST: Multiple endpoints, often fetching more than needed
- GraphQL: Single endpoint, fetch only requested fields

**3. Strong Typing**
- Type-safe queries and mutations
- Auto-generated TypeScript types
- Better IDE support

**4. Single Endpoint**
- `/api/graphql` instead of many REST endpoints
- Easier versioning and evolution

### Disadvantages

**1. Learning Curve**
- Team needs to learn GraphQL
- Different mental model from REST

**2. Caching Complexity**
- HTTP caching is less straightforward
- Need GraphQL-specific caching strategies

**3. File Uploads**
- More complex than REST multipart
- Need special handling or separate endpoint

**4. Over-engineering Risk**
- For simple CRUD, REST might be simpler
- GraphQL adds complexity for small projects

---

## Next.js Integration Options

### Option 1: Apollo Server (Recommended)

**Pros:**
- Mature, well-documented
- Great TypeScript support
- Excellent tooling (Apollo Studio)
- Works seamlessly with Next.js App Router

**Cons:**
- Larger bundle size
- More opinionated

**Installation:**
```bash
bun add @apollo/server graphql @as-integrations/next
bun add -d @graphql-codegen/cli @graphql-codegen/typescript
```

### Option 2: GraphQL Yoga

**Pros:**
- Lightweight
- Modern, fast
- Good TypeScript support

**Cons:**
- Less ecosystem
- Smaller community

**Installation:**
```bash
bun add graphql-yoga graphql
```

### Option 3: Pothos (Schema Builder)

**Pros:**
- Type-safe schema building
- No code generation needed
- Great for TypeScript-first projects

**Cons:**
- Different approach (schema-first vs code-first)
- Learning curve

**Installation:**
```bash
bun add @pothos/core @pothos/plugin-prisma
```

---

## Apollo Server Setup

### Basic Setup

**1. Create GraphQL Route**

```typescript
// app/api/graphql/route.ts
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { typeDefs } from '@/graphql/schema';
import { resolvers } from '@/graphql/resolvers';
import { requireAuth } from '@/features/auth/services/firebase-middleware';
import { NextRequest } from 'next/server';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV === 'development',
  plugins: [
    // Add plugins for logging, error handling, etc.
  ],
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req: NextRequest) => {
    // Extract auth token from headers
    const authHeader = req.headers.get('authorization');
    
    // Verify authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      throw new Error('Unauthorized');
    }
    
    return {
      user: authResult.user,
      firebaseUser: authResult.firebaseUser,
      userId: authResult.userId,
      req,
    };
  },
});

export { handler as GET, handler as POST };
```

### With Route Protection

```typescript
// app/api/graphql/route.ts
import { withUserProtection } from '@/shared/middleware/api-route-protection';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    // Auth already verified by middleware
    const authResult = await requireAuth(req);
    return {
      user: authResult.user,
      // ... other context
    };
  },
});

const handler = startServerAndCreateNextHandler(server);

// Apply protection middleware
export const GET = withUserProtection(handler, {
  rateLimitType: 'auth',
});

export const POST = withUserProtection(handler, {
  rateLimitType: 'auth',
});
```

---

## Schema Design

### Type Definitions

```graphql
# graphql/schema/types/user.graphql
type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  orders: [Order!]!
  subscription: Subscription
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  CUSTOMER
  ADMIN
}

# graphql/schema/types/order.graphql
type Order {
  id: ID!
  userId: ID!
  user: User!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
}

type OrderItem {
  id: ID!
  name: String!
  price: Float!
  quantity: Int!
}

enum OrderStatus {
  PENDING
  COMPLETED
  CANCELLED
  REFUNDED
}
```

### Queries

```graphql
# graphql/schema/queries.graphql
type Query {
  # User queries
  me: User!
  user(id: ID!): User
  
  # Order queries
  orders(
    page: Int = 1
    pageSize: Int = 20
    status: OrderStatus
    userId: ID
  ): OrderConnection!
  
  order(id: ID!): Order
  
  # Subscription queries
  subscription: Subscription
  subscriptions(
    page: Int = 1
    pageSize: Int = 20
    tier: SubscriptionTier
    status: SubscriptionStatus
  ): SubscriptionConnection!
}
```

### Mutations

```graphql
# graphql/schema/mutations.graphql
type Mutation {
  # Order mutations
  createOrder(input: CreateOrderInput!): Order!
  updateOrder(id: ID!, input: UpdateOrderInput!): Order!
  cancelOrder(id: ID!): Order!
  
  # Subscription mutations
  createCheckoutSession(input: CheckoutInput!): CheckoutSession!
  cancelSubscription: Subscription!
  
  # User mutations
  updateProfile(input: UpdateProfileInput!): User!
}
```

---

## Authentication & Authorization

### Context-Based Auth

```typescript
// graphql/context.ts
import { requireAuth } from '@/features/auth/services/firebase-middleware';
import { NextRequest } from 'next/server';

export interface GraphQLContext {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export async function createContext(req: NextRequest): Promise<GraphQLContext> {
  try {
    const authResult = await requireAuth(req);
    
    if (authResult instanceof Response) {
      return {
        user: null,
        firebaseUser: null,
        userId: null,
        isAuthenticated: false,
        isAdmin: false,
      };
    }
    
    return {
      user: authResult.user,
      firebaseUser: authResult.firebaseUser,
      userId: authResult.userId,
      isAuthenticated: true,
      isAdmin: authResult.user.role === 'admin',
    };
  } catch {
    return {
      user: null,
      firebaseUser: null,
      userId: null,
      isAuthenticated: false,
      isAdmin: false,
    };
  }
}
```

### Field-Level Authorization

```typescript
// graphql/resolvers/user.ts
import { GraphQLContext } from '../context';

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.isAuthenticated) {
        throw new Error('Unauthorized');
      }
      
      return await prisma.user.findUnique({
        where: { id: context.userId },
        include: { orders: true },
      });
    },
    
    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      // Admin can view any user
      if (context.isAdmin) {
        return await prisma.user.findUnique({ where: { id } });
      }
      
      // Users can only view themselves
      if (context.userId === id) {
        return await prisma.user.findUnique({ where: { id } });
      }
      
      throw new Error('Forbidden');
    },
  },
  
  User: {
    orders: async (parent: User, __: any, context: GraphQLContext) => {
      // Only return orders if user is viewing themselves or is admin
      if (context.isAdmin || context.userId === parent.id) {
        return await prisma.order.findMany({
          where: { userId: parent.id },
        });
      }
      
      return [];
    },
  },
};
```

---

## Migration Strategy

### Phase 1: Coexistence (Recommended)

**Keep REST APIs, add GraphQL alongside:**

```
app/api/
├── graphql/              # New GraphQL endpoint
│   └── route.ts
├── admin/                # Keep existing REST
├── customer/             # Keep existing REST
└── subscriptions/        # Keep existing REST
```

**Benefits:**
- No breaking changes
- Gradual migration
- Test GraphQL with real usage
- Can revert if needed

### Phase 2: Parallel Implementation

**Implement GraphQL for new features:**

```typescript
// New feature: Use GraphQL
mutation CreateSubscription {
  createSubscription(input: {
    tier: PRO
    billingCycle: MONTHLY
  }) {
    id
    tier
    status
  }
}

// Old feature: Keep REST
POST /api/subscriptions/checkout
```

### Phase 3: Gradual Migration

**Migrate endpoints one by one:**

1. Start with read-only queries (GET endpoints)
2. Then mutations (POST/PUT/DELETE)
3. Keep REST for file uploads initially
4. Eventually deprecate REST endpoints

### Phase 4: Full GraphQL (Optional)

**Only if GraphQL proves beneficial:**
- Remove REST endpoints
- Use GraphQL for everything
- Keep REST only for file uploads or special cases

---

## Hybrid Approach

### Best of Both Worlds

**Use GraphQL for:**
- Complex queries with relationships
- Mobile apps (single endpoint)
- Real-time subscriptions
- Type-safe API

**Keep REST for:**
- File uploads
- Webhooks
- Simple CRUD operations
- Third-party integrations

### Example Structure

```typescript
// GraphQL for complex queries
query GetUserDashboard {
  user {
    orders(status: COMPLETED) {
      id
      total
      items {
        name
      }
    }
    subscription {
      tier
      status
    }
    usageStats {
      currentUsage
      limit
    }
  }
}

// REST for file uploads
POST /api/shared/upload
Content-Type: multipart/form-data
```

---

## Best Practices

### 1. Use Code Generation

```bash
# Generate TypeScript types from schema
bun add -d @graphql-codegen/cli @graphql-codegen/typescript
```

```yaml
# codegen.yml
schema: './graphql/schema/**/*.graphql'
generates:
  ./graphql/generated/types.ts:
    plugins:
      - typescript
      - typescript-resolvers
```

### 2. Implement DataLoader for N+1 Queries

```typescript
// graphql/dataloaders.ts
import DataLoader from 'dataloader';

export const userLoader = new DataLoader(async (userIds: string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });
  
  return userIds.map(id => users.find(u => u.id === id));
});
```

### 3. Use GraphQL Subscriptions for Real-time

```typescript
// For real-time updates (WebSocket)
import { createServer } from '@graphql-yoga/node';

const server = createServer({
  schema,
  subscriptions: {
    graphqlWs: true,
  },
});
```

### 4. Implement Query Complexity Analysis

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation({ request, operation }) {
            const complexity = calculateComplexity(operation);
            if (complexity > 100) {
              throw new Error('Query too complex');
            }
          },
        };
      },
    },
  ],
});
```

### 5. Rate Limiting per Query

```typescript
// Apply rate limiting to expensive queries
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation({ request, operation }) {
            // Apply rate limiting based on operation
            if (operation.operation === 'mutation') {
              // Stricter limits for mutations
            }
          },
        };
      },
    },
  ],
});
```

---

## Recommendation

### For Your Current Architecture

**Recommendation: Hybrid Approach**

1. **Keep REST APIs** - They're working well, no need to break them
2. **Add GraphQL for:**
   - Complex dashboard queries
   - Mobile app (if planned)
   - Admin analytics (complex aggregations)
   - Real-time features

3. **Migration Path:**
   - Start with read-only queries
   - Add GraphQL for new features
   - Gradually migrate high-value endpoints
   - Keep REST for file uploads and simple operations

**When to Fully Migrate:**
- If you're building a mobile app
- If you have complex data relationships
- If over-fetching is a real problem
- If team is comfortable with GraphQL

**When NOT to Migrate:**
- If REST is working fine
- If team is small and REST is simpler
- If you don't have complex data needs
- If you need simple CRUD only

---

## Related Documentation

- [API Architecture](./api-architecture.md) - Current REST API patterns
- [API Route Protection](./api-route-protection.md) - Auth & security
- [Error Handling](./error-handling.md) - Error patterns

---

*Last Updated: December 2025*
