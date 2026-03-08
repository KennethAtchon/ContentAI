# Frontend - WebsiteTemplate2

Modern React frontend built with Vite, TanStack Router, and TanStack Query.

## Tech Stack

- **Build Tool**: Vite 6
- **Framework**: React 19
- **Router**: TanStack Router (file-based routing)
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Forms**: React Hook Form + Zod
- **Internationalization**: i18next + react-i18next
- **Authentication**: Firebase Auth
- **Fonts**: Inter (sans-serif), Lora (serif)

## Getting Started

### Prerequisites

- Bun 1.2.14 or later
- Node.js 18+ (for compatibility)

### Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

### Development

```bash
# Start development server (with HMR)
bun run dev
```

The app will be available at `http://localhost:3000`.

### Building

```bash
# Type check
bun run build

# Preview production build
bun run preview
```

### Testing

```bash
# Run unit tests
bun run test:unit

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Linting & Formatting

```bash
# Lint code
bun run lint

# Format code
bun run format

# Check formatting
bun run format:check
```

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── features/        # Feature modules (copied from project/)
│   ├── lib/             # Core libraries (Firebase, i18n)
│   ├── providers/       # React context providers
│   ├── routes/          # TanStack Router file-based routes
│   ├── shared/          # Shared components, hooks, utils
│   ├── styles/          # Global styles
│   ├── translations/    # i18n translation files
│   ├── main.tsx         # App entry point
│   └── vite-env.d.ts    # Vite environment types
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tailwind.config.ts   # Tailwind configuration
└── tsconfig.json        # TypeScript configuration
```

## Environment Variables

See `.env.example` for required environment variables:

- `VITE_API_URL` - Backend API URL
- `VITE_FIREBASE_*` - Firebase configuration
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `VITE_APP_NAME` - Application name
- `VITE_APP_URL` - Application URL

## Routing

This project uses TanStack Router with file-based routing. Routes are defined in `src/routes/`:

- `__root.tsx` - Root layout
- `index.tsx` - Home page (`/`)
- `_auth/` - Authenticated routes (requires login)
- `admin/` - Admin routes (requires admin role)

## API Integration

API calls are proxied through Vite dev server to the backend at `http://localhost:3001` (configurable via `VITE_API_URL`).

## Deployment

The frontend builds to static files in the `dist/` directory and can be deployed to:

- Cloudflare Pages
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## Migration Notes

This frontend was migrated from Next.js 16. Key changes:

- **Routing**: Next.js App Router → TanStack Router
- **i18n**: next-intl → i18next + react-i18next
- **Fonts**: next/font → @fontsource packages
- **Images**: next/image → standard `<img>` tags
- **SEO**: generateMetadata → react-helmet-async
- **Themes**: next-themes → custom ThemeProvider

All client-side components, hooks, and utilities were copied unchanged from the Next.js project.
