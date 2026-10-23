# syntax=docker/dockerfile:1
# One-shot demo seeder image (compose `seed` profile). Carries BOTH toolchains the
# two-phase seed needs: Foundry (forge, for the on-chain DemoSeed script) and
# node+pnpm+prisma (for the offchain `prisma db seed`). Not built on a normal `up`.
FROM ghcr.io/foundry-rs/foundry:latest AS foundry

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
# openssl/ca-certificates for the Prisma engine; git for forge's commit metadata.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates git \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# forge + cast from the official Foundry image.
COPY --from=foundry /usr/local/bin/forge /usr/local/bin/forge
COPY --from=foundry /usr/local/bin/cast /usr/local/bin/cast

# Full repo context: the seed needs the contracts source + deployments/84532.json, the
# @amanah/db + @amanah/shared packages, and scripts/seed-demo.sh.
COPY . .
RUN pnpm install --frozen-lockfile
# Build shared (addresses/ABIs) + db (prisma client w/ debian engine) so both seed
# phases resolve. The forge script compiles contracts on first run.
RUN pnpm --filter @amanah/shared build && pnpm --filter @amanah/db build

CMD ["bash", "scripts/seed-demo.sh"]
