# Backend Dockerfile
# Shared Bun base keeps frontend/backend layers aligned while staying lightweight on Alpine.
FROM oven/bun:1.2.14-alpine AS base

WORKDIR /app

# fontconfig + DejaVu: drawtext in editor export; curl/psql for ops / debugging.
RUN apk add --no-cache \
    curl \
    ffmpeg \
    font-dejavu \
    fontconfig \
    postgresql16-client \
    tzdata

# Install dependencies only when needed
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Development stage
FROM base AS development
ENV NODE_ENV=development

COPY package.json bun.lock bunfig.toml ./
COPY scripts ./scripts

# Expose port
EXPOSE 3001

# Keep dependencies inside a Linux volume instead of reusing host-built modules.
CMD ["sh", "scripts/docker-entrypoint-dev.sh"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM base AS production
ENV NODE_ENV=production

COPY package.json bun.lock bunfig.toml ./

# Install production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Expose port
EXPOSE 3001

# Seed and start production server
CMD ["sh", "scripts/start.sh"]
