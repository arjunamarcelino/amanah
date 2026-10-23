# syntax=docker/dockerfile:1
# @amanah/indexer — viem on-chain event indexer (worker; no HTTP port).
# Depends on @amanah/db, so it loads the Prisma query engine at runtime.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app

FROM base AS prune
RUN pnpm add -g turbo@2.11.9
COPY . .
RUN turbo prune @amanah/indexer --docker

FROM base AS installer
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=@amanah/indexer

FROM base AS runner
# Prisma engine (via @amanah/db) needs OpenSSL 3 at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nodejs
COPY --from=builder --chown=nodejs:nodejs /app .
USER nodejs
# Worker: no EXPOSE.
CMD ["node", "apps/indexer/dist/index.js"]
