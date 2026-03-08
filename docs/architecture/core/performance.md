# Performance & Caching

## Overview

Multi-layer caching strategy combining Redis (server-side), TanStack Query (client-side), and standard HTTP caching for optimal performance.

**Caching Layers:**
- Redis (server-side caching)
- Next.js (static generation, ISR)
- Client-side (React Query, browser cache)

---

## Table of Contents

1. [Redis Caching](#redis-caching)
2. [Next.js Caching](#nextjs-caching)
3. [Client-Side Caching](#client-side-caching)
4. [Performance Optimization](#performance-optimization)
5. [Best Practices](#best-practices)

---

## Redis Caching

**Location:** `shared/services/db/redis.ts`

### Redis Client

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default redis
```

### Caching Pattern

```typescript
async function getCachedData(key: string, fetchFn: () => Promise<any>, ttl = 3600) {
  // Try cache first
  const cached = await redis.get(key)
  if (cached) return cached
  
  // Fetch and cache
  const data = await fetchFn()
  await redis.setex(key, ttl, JSON.stringify(data))
  
  return data
}

// Usage
const users = await getCachedData(
  'users:all',
  () => prisma.user.findMany(),
  600  // 10 minutes
)
```

### Cache Invalidation

```typescript
// Invalidate specific key
await redis.del('users:all')

// Invalidate pattern
await redis.del('users:*')

// On data mutation
await prisma.user.update({...})
await redis.del(`user:${userId}`)
```

---

## Next.js Caching

### Static Site Generation (SSG)

```typescript
// app/page.tsx - Static at build time
export default async function Home() {
  const data = await fetchStaticData()
  return <HomeView data={data} />
}
```

### Incremental Static Regeneration (ISR)

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600 // Revalidate every hour

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  return <PostView post={post} />
}
```

### Dynamic with Cache

```typescript
// app/api/users/route.ts
export async function GET() {
  const users = await prisma.user.findMany()
  
  return NextResponse.json(
    { users },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    }
  )
}
```

---

## Client-Side Caching

### SWR Pattern (Primary Caching Solution)

**Location:** `shared/providers/swr-provider.tsx`, `shared/hooks/use-swr-fetcher.ts`

The application uses **SWR** (stale-while-revalidate) for all client-side API call caching. SWR provides automatic caching, deduplication, background revalidation, and error retry.

```typescript
'use client'

import useSWR from 'swr'
import { useSWRFetcher } from '@/shared/hooks/use-swr-fetcher'

export function UserProfile() {
  const fetcher = useSWRFetcher()
  const { data, error, isLoading } = useSWR('/api/customer/profile', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,  // Dedupe requests within 2s
    refreshInterval: 300000,  // Refresh every 5 minutes
  })
  
  if (isLoading) return <Loading />
  if (error) return <Error />
  
  return <Profile data={data} />
}
```

**Key Features:**
- Automatic caching with configurable TTL
- Request deduplication (multiple components = one request)
- Background revalidation (stale-while-revalidate)
- Error retry with exponential backoff
- Cache invalidation via `mutate()` function

### SWR (Stale-While-Revalidate)

**Note:** The application uses **SWR** exclusively for client-side caching. React Query is not used.

```typescript
'use client'

import useSWR from 'swr'
import { useSWRFetcher } from '@/shared/hooks/use-swr-fetcher'

export function Users() {
  const fetcher = useSWRFetcher()
  const { data, isLoading } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,  // 2 seconds
  })
  
  return <UserList users={data?.users} />
}
```

---

## Performance Optimization

### React Optimization

```typescript
// Memoization
const MemoizedComponent = React.memo(ExpensiveComponent)

// useMemo for expensive computations
const sorted = useMemo(() => {
  return data.sort((a, b) => a.value - b.value)
}, [data])

// useCallback for stable function references
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])
```

### Image Optimization

```typescript
import Image from 'next/image'

// Optimized images
<Image
  src="/image.jpg"
  width={800}
  height={600}
  alt="Description"
  loading="lazy"
  placeholder="blur"
/>
```

### Code Splitting

```typescript
// Dynamic imports
const DynamicComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Loading />,
  ssr: false,  // Client-side only
})
```

---

## Best Practices

### Caching Strategy

- ✅ Cache frequently accessed data (user profiles, configs)
- ✅ Set appropriate TTL based on data freshness needs
- ✅ Invalidate cache on mutations
- ✅ Use stale-while-revalidate for better UX

### Performance

- ✅ Use Next.js Image component
- ✅ Implement code splitting for large components
- ✅ Memoize expensive computations
- ✅ Use pagination for large datasets
- ✅ Optimize database queries (indexes, select only needed fields)

### Monitoring

- ✅ Track Core Web Vitals (LCP, FID, CLS)
- ✅ Monitor cache hit rates
- ✅ Log slow queries
- ✅ Use performance profiling tools

---

## Related Documentation

- [Database](./database.md) - Database query optimization
- [API Architecture](./api.md) - API response caching

---

*Last Updated: January 2026*
