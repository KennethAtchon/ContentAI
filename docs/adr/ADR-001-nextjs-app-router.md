# ADR-001: Use Next.js App Router

**Date:** Nov 2025
**Status:** Superseded

> **Superseded in 2026** by migration to Vite + TanStack Router (frontend) and Hono + Bun (backend). Next.js was removed entirely. See [architecture/overview.md](../architecture/overview.md) for the current stack.

## Context

We need a React framework that supports SSR, SEO, API routes, and easy deployment. The project will have public marketing pages, authenticated customer pages, and admin pages.

## Decision

Use **Next.js 15** with the **App Router** (`app/` directory) and React Server Components.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Next.js Pages Router | Legacy; App Router is the recommended path |
| Remix | Smaller ecosystem; team familiarity lower |
| Vite + React SPA | No built-in SSR; poor SEO for public pages |

## Consequences

- ✅ Excellent SSR and SEO for public marketing pages
- ✅ API routes co-located with the app (no separate backend service)
- ✅ React Server Components reduce client-side JS bundle
- ✅ Vercel/Railway deployment straightforward
- ⚠️ App Router has higher complexity than Pages Router; team must learn RSC patterns
- ⚠️ Some Firebase SDK features require client components (`"use client"`)
