# syntax=docker/dockerfile:1
# @amanah/indexer — viem on-chain event indexer (worker; no HTTP port).
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @amanah/indexer... build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/indexer
CMD ["node", "dist/index.js"]
