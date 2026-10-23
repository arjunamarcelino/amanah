# syntax=docker/dockerfile:1
# @amanah/api — NestJS REST API + Prisma 6. Turbo-pruned multi-stage.
# This image also backs the one-shot `migrate` service: it carries pnpm, the
# prisma CLI (a devDependency of @amanah/db), schema.prisma + prisma/migrations,
# and the generated client — so `prisma migrate deploy` can run from it.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app

FROM base AS prune
# turbo pinned 2.11.9, installed globally (prune runs before workspace deps exist); this
# version keeps the pnpm catalog in the pruned lockfile so --frozen-lockfile won't abort.
RUN pnpm add -g turbo@2.11.9
COPY . .
RUN turbo prune @amanah/api --docker

FROM base AS installer
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=prune /app/out/full/ .
# @amanah/db build (^build): rm -rf dist && prisma generate && tsc &&
# cp -R src/generated dist/generated — emits the debian-openssl-3.0.x engine.
RUN pnpm turbo run build --filter=@amanah/api

# runner: carries the prisma engine + CLI + migrations; non-root.
FROM base AS runner
# Prisma 6 query engine on bookworm/OpenSSL 3 needs these shared libs at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nodejs
# Copy the whole built workspace (official Turborepo pnpm pattern): preserves the
# pnpm symlink farm, the generated prisma client/engine, and — for the migrate
# service — the prisma CLI + schema + prisma/migrations.
COPY --from=builder --chown=nodejs:nodejs /app .
USER nodejs
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
