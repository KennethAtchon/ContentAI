# Backend Dockerfile
FROM oven/bun:1.2.14-alpine AS base

WORKDIR /workspace

RUN apk add --no-cache \
    curl \
    ffmpeg \
    font-dejavu \
    fontconfig \
    postgresql16-client \
    tzdata

FROM base AS deps
COPY . .
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

FROM base AS development
ENV NODE_ENV=development

COPY . .

EXPOSE 3001

CMD ["sh", "backend/scripts/docker-entrypoint-dev.sh"]

FROM base AS builder
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

RUN cd backend && bun run build

FROM base AS production
ENV NODE_ENV=production

COPY . .
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile --production; else bun install --production; fi

COPY --from=builder /workspace/backend/dist ./backend/dist

EXPOSE 3001

CMD ["sh", "backend/scripts/start.sh"]
