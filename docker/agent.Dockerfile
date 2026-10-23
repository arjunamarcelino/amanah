# syntax=docker/dockerfile:1
# @amanah/agent — Fastify AI off-ramp router. Internal-only (never proxied).
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
RUN turbo prune @amanah/agent --docker

FROM base AS installer
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=@amanah/agent

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nodejs
COPY --from=builder --chown=nodejs:nodejs /app .
USER nodejs
# Reached only over the compose network by api/web; EXPOSE documents the port.
EXPOSE 5000
CMD ["node", "apps/agent/dist/index.js"]
