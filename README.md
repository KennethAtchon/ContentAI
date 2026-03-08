# WebsiteTemplate2

A **modern SaaS template** with split frontend/backend architecture. Built with Vite + React (frontend) and Hono on Bun (backend). Includes auth, subscriptions, payments, and admin panel.

## Architecture

This project uses a **split architecture** for better scalability and developer experience:

- **Frontend**: Vite + React 19 + TanStack Router (SPA deployed to CDN)
- **Backend**: Hono on Bun (API server with full Node.js capabilities)

### Why Split Architecture?

- ✅ **Faster builds**: Vite builds in ~10s vs Next.js ~30-60s
- ✅ **Better DX**: HMR in <50ms, no server/client boundary confusion
- ✅ **Independent scaling**: Frontend on CDN, backend scales separately
- ✅ **No edge runtime limits**: Full access to Redis, Prisma, crypto in middleware
- ✅ **Simpler deployment**: Static frontend + containerized backend

---

## Quick Start

### 1. Clone

```bash
git clone <this-repo> your-project
cd your-project
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
bun install

# Install backend dependencies
cd ../backend
bun install
```

### 3. Environment Variables

```bash
# Frontend
cd frontend
cp .env.example .env
# Edit with Firebase, Stripe public key, API URL

# Backend
cd ../backend
cp .env.example .env
# Edit with database, Firebase Admin, Stripe secret, etc.
```

### 4. Database Setup

```bash
cd backend
bun run db:generate
bun run db:migrate
```

### 5. Run Development Servers

```bash
# Terminal 1 - Backend (API server)
cd backend
bun run dev
# Runs on http://localhost:3001

# Terminal 2 - Frontend (Vite dev server)
cd frontend
bun run dev
# Runs on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 6. Customize Your App

- **Branding**: Update `frontend/src/translations/en.json` with your app name and copy
- **Features**: Add/modify features in `frontend/src/features/`
- **API Routes**: Add backend routes in `backend/src/routes/`
- **Styling**: Customize Tailwind theme in `frontend/tailwind.config.ts`

---

## What's Included

### Frontend (Vite + React)
- ✅ **Routing**: TanStack Router with file-based routing
- ✅ **State Management**: TanStack Query for server state
- ✅ **UI Components**: Radix UI + Tailwind CSS 4
- ✅ **Forms**: React Hook Form + Zod validation
- ✅ **Auth**: Firebase Auth client SDK
- ✅ **i18n**: i18next for internationalization
- ✅ **SEO**: react-helmet-async for meta tags
- ✅ **Themes**: Custom theme provider (dark/light mode)

### Backend (Hono on Bun)
- ✅ **API Framework**: Hono (ultra-lightweight, TypeScript-first)
- ✅ **Database**: PostgreSQL with Prisma ORM
- ✅ **Auth**: Firebase Admin SDK for token verification
- ✅ **Payments**: Stripe integration (subscriptions + one-time)
- ✅ **Email**: Resend for transactional emails
- ✅ **Storage**: AWS S3/R2 integration
- ✅ **Caching**: Redis for rate limiting and sessions
- ✅ **Security**: CORS, CSRF, rate limiting, security headers
- ✅ **Monitoring**: Prometheus metrics, structured logging

### Features (Ready to Use)
- ✅ **Authentication**: Sign up, sign in, OAuth, password reset
- ✅ **Subscriptions**: Stripe subscription tiers and management
- ✅ **Admin Panel**: User management, orders, analytics
- ✅ **Usage Tracking**: Per-user usage limits and tracking
- ✅ **Contact Forms**: With email notifications
- ✅ **Legal Pages**: Terms, privacy, cookie policy templates

---

## Project Structure

```
WebsiteTemplate2/
├── frontend/              # Vite + React SPA
│   ├── src/
│   │   ├── routes/        # TanStack Router routes
│   │   ├── features/      # Feature modules
│   │   ├── shared/        # Shared components, hooks, utils
│   │   ├── providers/     # React context providers
│   │   ├── lib/           # Core libraries (Firebase, i18n)
│   │   └── translations/  # i18n files
│   ├── public/            # Static assets
│   └── package.json
│
├── backend/               # Hono API on Bun
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, CSRF, rate limiting
│   │   ├── utils/         # Utilities
│   │   └── infrastructure/ # Prisma, database
│   └── package.json
│
├── docs/                  # Documentation
└── MIGRATION_GUIDE.md     # Next.js → Vite migration guide
```

## Documentation

- **[Migration Guide](MIGRATION_GUIDE.md)** — Complete guide for migrating from Next.js
- **[Frontend README](frontend/README.md)** — Frontend setup and development
- **[Backend README](backend/README.md)** — Backend API documentation
- [Template Guide](docs/TEMPLATE_GUIDE.md) — Full project reference
- [AI_Orchestrator](docs/AI_Orchestrator/index.md) — Architecture docs

---

## Scripts

### Frontend
```bash
cd frontend
bun run dev          # Start dev server (port 3000)
bun run build        # Production build
bun run preview      # Preview production build
bun run lint         # Lint code
bun run test         # Run tests
```

### Backend
```bash
cd backend
bun run dev          # Start API server (port 3001)
bun run build        # Build for production
bun run start        # Start production server
bun run db:generate  # Generate Prisma client
bun run db:migrate   # Run migrations
bun run db:studio    # Open Prisma Studio
bun run test         # Run tests
```

---

## Tech Stack

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Router**: TanStack Router
- **State**: TanStack Query
- **Styling**: Tailwind CSS 4
- **UI**: Radix UI
- **Forms**: React Hook Form + Zod
- **i18n**: i18next

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL + Prisma
- **Auth**: Firebase Admin SDK
- **Payments**: Stripe
- **Email**: Resend
- **Cache**: Redis (ioredis)

---

## Migration from Next.js

This project was migrated from Next.js to a split Vite + Hono architecture. The original Next.js project is preserved in `project/` for reference.

See **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** for:
- Complete migration steps
- Code conversion examples
- Deployment instructions
- Troubleshooting guide

---

## Deployment

### Frontend (Static SPA)
Deploy to any static hosting:
- **Cloudflare Pages** (recommended)
- Vercel
- Netlify
- AWS S3 + CloudFront

### Backend (API Server)
Deploy to any container platform:
- **Railway** (recommended)
- Fly.io
- AWS ECS/Fargate
- DigitalOcean App Platform

See deployment guides in `frontend/README.md` and `backend/README.md`.
