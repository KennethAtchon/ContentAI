# Admin Dashboard - Domain Architecture

## Overview

The Admin Dashboard provides administrators with centralized access to manage customers, orders, subscriptions, and analytics. It features role-based access control, real-time metrics, and comprehensive CRUD operations for all entities.

**Key Functionality:**
- **Metrics Dashboard:** MRR, active subscriptions, ARPU, churn rate, conversion rate
- **Order Management:** View, search, filter, update, soft delete orders
- **Subscription Management:** View Firestore subscriptions, analytics, portal access
- **Customer Management:** View, search, edit customer profiles
- **Analytics:** Revenue trends, subscription metrics, customer growth

---

## Table of Contents

1. [Admin Authentication](#admin-authentication)
2. [Dashboard Metrics](#dashboard-metrics)
3. [Order Management](#order-management)
4. [Subscription Management](#subscription-management)
5. [Customer Management](#customer-management)
6. [Analytics APIs](#analytics-apis)

---

## Admin Authentication

### Server-Side Admin Middleware

**Location:** `features/auth/services/firebase-middleware.ts`

```typescript
import { requireAuth } from '@/features/auth/services/firebase-middleware';

export async function requireAdmin(request: NextRequest) {
  // First verify authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult; // Unauthorized
  }

  // Check if user has admin role in database (from profile)
  if (authResult.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  return authResult; // { firebaseUser, user }
}
```

**Usage in API Routes:**

```typescript
// app/api/admin/analytics/route.ts
import { requireAdmin } from '@/features/auth/services/firebase-middleware';
import { withAdminProtection } from '@/shared/middleware/api-route-protection';

async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;
  
  // Admin-only logic here
  return NextResponse.json({ data: analytics });
}

export const GET = withAdminProtection(getHandler);
```

### Client-Side Admin Guard

**Location:** `features/auth/components/auth-guard.tsx`

```typescript
import { useApp } from '@/shared/contexts/app-context';

export function AuthGuard({ requireAuth, requireAdmin, children }) {
  const { user, profile, isAdmin, authLoading } = useApp();
  const router = useRouter();

  // Check admin status from profile (already loaded via AppContext)
  if (requireAdmin && !authLoading) {
    if (!isAdmin) {
      router.push('/');
      return <div>Redirecting...</div>;
    }
  }

  if (requireAuth && !authLoading && !user) {
    router.push('/sign-in');
    return <div>Redirecting...</div>;
  }

  if (authLoading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
```

**Note:** The `AuthGuard` uses `useApp()` from `app-context.tsx`, which provides `isAdmin` computed from the user profile's role field.

---

## Dashboard Metrics

### Metrics API Endpoints

#### GET /api/admin/subscriptions/analytics

**Functionality:** Retrieve subscription metrics from Firestore

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const db = getFirestore();
  
  // Get all active subscriptions from Firestore
  const customersSnapshot = await db.collection('customers').get();
  
  let activeSubscriptions = 0;
  let totalMRR = 0;
  let canceledLastMonth = 0;
  let totalActiveUsers = 0;

  for (const customerDoc of customersSnapshot.docs) {
    const subscriptionsSnapshot = await db
      .collection('customers')
      .doc(customerDoc.id)
      .collection('subscriptions')
      .where('status', 'in', ['active', 'trialing'])
      .get();

    for (const subDoc of subscriptionsSnapshot.docs) {
      const sub = subDoc.data();
      activeSubscriptions++;
      totalActiveUsers++;

      // Calculate MRR (Monthly Recurring Revenue)
      if (sub.items && sub.items[0]?.price) {
        const price = sub.items[0].price;
        const amount = price.unit_amount / 100; // Convert cents to dollars
        
        if (price.interval === 'year') {
          totalMRR += amount / 12; // Convert annual to monthly
        } else {
          totalMRR += amount;
        }
      }
    }
  }

  // Calculate churn rate (simplified)
  const churnRate = totalActiveUsers > 0 
    ? (canceledLastMonth / totalActiveUsers) * 100 
    : 0;

  // Calculate ARPU (Average Revenue Per User)
  const arpu = totalActiveUsers > 0 ? totalMRR / totalActiveUsers : 0;

  return NextResponse.json({
    activeSubscriptions,
    mrr: Math.round(totalMRR * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
  });
}
```

#### GET /api/users/customers-count

**Functionality:** Count total customers with month-over-month comparison

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Count customers created this month
  const totalCustomers = await prisma.user.count({
    where: {
      role: 'user',
      isDeleted: false,
    },
  });

  // Count customers created last month
  const lastMonthCustomers = await prisma.user.count({
    where: {
      role: 'user',
      isDeleted: false,
      createdAt: {
        gte: startOfLastMonth,
        lt: startOfMonth,
      },
    },
  });

  // Calculate percentage change
  const percentChange = lastMonthCustomers > 0
    ? ((totalCustomers - lastMonthCustomers) / lastMonthCustomers) * 100
    : null;

  return NextResponse.json({
    totalCustomers,
    percentChange: percentChange ? Math.round(percentChange * 10) / 10 : null,
  });
}
```

#### GET /api/customer/orders/total-revenue

**Functionality:** Calculate total revenue from one-time orders

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Aggregate total revenue
  const totalRevenue = await prisma.order.aggregate({
    where: {
      isDeleted: false,
      status: 'completed',
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Aggregate last month revenue
  const lastMonthRevenue = await prisma.order.aggregate({
    where: {
      isDeleted: false,
      status: 'completed',
      createdAt: {
        gte: startOfLastMonth,
        lt: startOfMonth,
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  const total = Number(totalRevenue._sum.totalAmount || 0);
  const lastMonth = Number(lastMonthRevenue._sum.totalAmount || 0);
  const percentChange = lastMonth > 0 ? ((total - lastMonth) / lastMonth) * 100 : null;

  return NextResponse.json({
    totalRevenue: total,
    percentChange: percentChange ? Math.round(percentChange * 10) / 10 : null,
  });
}
```

#### GET /api/admin/analytics

**Functionality:** Calculate conversion rate metrics

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count total users
  const totalUsers = await prisma.user.count({
    where: { role: 'user', isDeleted: false },
  });

  // Count users with completed orders
  const usersWithOrders = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      status: 'completed',
      isDeleted: false,
      createdAt: { gte: startOfMonth },
    },
  });

  const conversionRate = totalUsers > 0
    ? (usersWithOrders.length / totalUsers) * 100
    : 0;

  return NextResponse.json({
    conversionRate: Math.round(conversionRate * 10) / 10,
    percentChange: null, // Could calculate if historical data is stored
  });
}
```

---

## Order Management

### Order APIs

#### GET /api/admin/orders

**Functionality:** List all orders with filtering and pagination

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status');

  const skip = (page - 1) * limit;

  const whereClause: any = {
    isDeleted: false,
  };

  // Filter by status
  if (status) {
    whereClause.status = status;
  }

  // Search by customer name/email or order ID
  if (search) {
    whereClause.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

#### PUT /api/admin/orders/:orderId

**Functionality:** Update order status or details

```typescript
async function putHandler(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { status, notes } = await request.json();

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data: {
      status,
      notes,
    },
    include: {
      user: true,
    },
  });

  debugLog.info('Order updated by admin', {
    service: 'admin-orders',
    operation: 'PUT',
  }, {
    orderId: order.id,
    adminId: adminResult.user.id,
  });

  return NextResponse.json({ order });
}
```

#### DELETE /api/admin/orders/:orderId

**Functionality:** Soft delete an order

```typescript
async function deleteHandler(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: adminResult.user.id,
    },
  });

  debugLog.info('Order soft deleted by admin', {
    service: 'admin-orders',
    operation: 'DELETE',
  }, {
    orderId: order.id,
    adminId: adminResult.user.id,
  });

  return NextResponse.json({ success: true });
}
```

---

## Subscription Management

### Subscription APIs

#### GET /api/admin/subscriptions

**Functionality:** Query Firestore subscriptions with filtering

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'active';
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = getFirestore();
  const subscriptions: any[] = [];

  // Query all customers
  const customersSnapshot = await db.collection('customers').limit(limit).get();

  for (const customerDoc of customersSnapshot.docs) {
    const customerData = customerDoc.data();
    
    // Query subscriptions for each customer
    let subscriptionsQuery = db
      .collection('customers')
      .doc(customerDoc.id)
      .collection('subscriptions');

    if (status !== 'all') {
      subscriptionsQuery = subscriptionsQuery.where('status', '==', status);
    }

    const subscriptionsSnapshot = await subscriptionsQuery.get();

    for (const subDoc of subscriptionsSnapshot.docs) {
      const subData = subDoc.data();
      subscriptions.push({
        id: subDoc.id,
        customerId: customerDoc.id,
        customerEmail: customerData.email,
        status: subData.status,
        role: subData.role,
        current_period_start: subData.current_period_start?.toDate(),
        current_period_end: subData.current_period_end?.toDate(),
        cancel_at_period_end: subData.cancel_at_period_end,
        items: subData.items,
        metadata: subData.metadata,
      });
    }
  }

  return NextResponse.json({ subscriptions });
}
```

---

## Customer Management

### Customer APIs

#### GET /api/admin/customers

**Functionality:** List all customers with search and filtering

```typescript
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const skip = (page - 1) * limit;

  const whereClause: any = {
    role: 'user',
    isDeleted: false,
  };

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firebaseUid: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

#### PUT /api/admin/customers/:customerId

**Functionality:** Update customer profile (admin override)

```typescript
async function putHandler(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { name, email, phone, address, notes } = await request.json();

  const customer = await prisma.user.update({
    where: { id: params.customerId },
    data: {
      name,
      email,
      phone,
      address,
      notes,
    },
  });

  debugLog.info('Customer profile updated by admin', {
    service: 'admin-customers',
    operation: 'PUT',
  }, {
    customerId: customer.id,
    adminId: adminResult.user.id,
  });

  return NextResponse.json({ customer });
}
```

---

## Analytics APIs

### Revenue Analytics

**Functionality:** Time-series revenue data for charts

```typescript
// GET /api/admin/analytics/revenue
async function getHandler(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month'; // 'week', 'month', 'year'

  const now = new Date();
  const startDate = getStartDate(period, now);

  // Group orders by date
  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      status: 'completed',
      createdAt: { gte: startDate },
    },
    select: {
      totalAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate by day/week/month
  const revenueData = aggregateRevenue(orders, period);

  return NextResponse.json({ revenueData });
}

function getStartDate(period: string, now: Date): Date {
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
```

---

## Best Practices

### 1. Always Use requireAdmin Middleware

```typescript
// ✅ CORRECT: Protect all admin routes
export const GET = async (request: NextRequest) => {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) return adminResult;
  
  // Admin logic here
};

// ❌ WRONG: No admin check
export const GET = async (request: NextRequest) => {
  // Anyone can access this
};
```

### 2. Soft Delete for Audit Trail

```typescript
// ✅ CORRECT: Soft delete with admin tracking
await prisma.order.update({
  where: { id: orderId },
  data: {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: adminId,
  },
});

// ❌ WRONG: Hard delete (no audit trail)
await prisma.order.delete({ where: { id: orderId } });
```

### 3. Log Admin Actions

```typescript
// ✅ CORRECT: Log all admin actions
debugLog.info('Admin action performed', {
  service: 'admin-orders',
  operation: 'DELETE',
}, {
  adminId: adminResult.user.id,
  adminEmail: adminResult.user.email,
  targetId: orderId,
});

// ❌ WRONG: No logging
await prisma.order.update({ ... });
```

### 4. Separate Firestore (Subscriptions) and Prisma (Orders)

```typescript
// ✅ CORRECT: Query Firestore for subscriptions
const db = getFirestore();
const subscriptions = await db.collection('customers')
  .doc(userId)
  .collection('subscriptions')
  .get();

// ✅ CORRECT: Query Prisma for orders
const orders = await prisma.order.findMany({
  where: { userId },
});

// ❌ WRONG: Don't mix them
const subscriptions = await prisma.subscription.findMany(); // NO! Use Firestore
```

---

## Related Documentation

- [Authorization Roles](../core/authorization-roles.md)
- [Order System](./order-system.md)
- [Subscription Architecture](./subscription-architecture.md)
- [Firebase Integration](./firebase-integration.md)

---

*Last Updated: December 2025*

