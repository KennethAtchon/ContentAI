# Backend Dockerfile
FROM oven/bun:1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
RUN bun install

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose port
EXPOSE 3001

# Seed and start server
CMD ["sh", "scripts/start.sh"]

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build environment variables
ARG DATABASE_URL
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_CLIENT_EMAIL
ARG FIREBASE_PRIVATE_KEY

ENV DATABASE_URL=$DATABASE_URL
ENV FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL
ENV FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY

# Build the application
RUN bun run build

# Production stage
FROM base AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat tzdata curl postgresql-client

# Copy package files
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock

# Install production dependencies
RUN bun install --production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Copy Drizzle migrations
COPY --from=builder /app/src/infrastructure/database/drizzle/migrations ./src/infrastructure/database/drizzle/migrations

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Seed and start production server
CMD ["sh", "scripts/start.sh"]
