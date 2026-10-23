# syntax=docker/dockerfile:1
# @amanah/web — Next.js 15 dApp (output: 'standalone'). Turbo-pruned multi-stage.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app

# prune: slice the monorepo down to @amanah/web + its workspace deps.
# turbo is installed globally here because workspace deps don't exist yet; pinned
# to 2.11.9 so the rewritten pruned lockfile keeps the pnpm catalog block
# (zod/viem) — otherwise `pnpm install --frozen-lockfile` aborts with
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
FROM base AS prune
RUN pnpm add -g turbo@2.11.9
COPY . .
RUN turbo prune @amanah/web --docker

# installer: install from the pruned lockfile (cached unless manifests change).
FROM base AS installer
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
# NEXT_PUBLIC_* are inlined at BUILD time (incl. the CSP connect-src computed in
# next.config.mjs) → they must exist before `next build`, as build ARGs.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
ARG NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=$NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID \
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=$NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=@amanah/web

# runner: self-contained standalone server, non-root.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
# outputFileTracingRoot=repo root ⇒ standalone mirrors the monorepo layout:
#   .next/standalone/{node_modules, apps/web/server.js, ...}
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
