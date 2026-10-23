# syntax=docker/dockerfile:1
# One-shot demo seeder image (compose `seed` profile). Carries BOTH toolchains the
# two-phase seed needs: Foundry (forge, for the on-chain DemoSeed script) and
# node+pnpm+prisma (for the offchain `prisma db seed`). Not built on a normal `up`.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

# openssl/ca-certificates for the Prisma engine; curl to bootstrap foundryup.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Install Foundry via foundryup so forge/cast match THIS image's platform
# (Debian/glibc). Copying prebuilt binaries from the foundry image risks a musl/glibc
# loader mismatch that fails at exec. `-i stable` is the latest stable channel; pin to a
# specific version/commit here if you need byte-for-byte reproducibility.
ENV FOUNDRY_DIR=/opt/foundry
ENV PATH="$FOUNDRY_DIR/bin:$PATH"
RUN curl -L https://foundry.paradigm.xyz | bash \
 && foundryup -i stable \
 && forge --version

WORKDIR /app
# Full repo context: the seed needs the contracts source + deployments/84532.json, the
# @amanah/db + @amanah/shared packages, and scripts/seed-demo.sh.
COPY . .
RUN pnpm install --frozen-lockfile
# Build shared (addresses/ABIs) + db (prisma client w/ debian engine) so both seed
# phases resolve. The forge script compiles contracts on first run.
RUN pnpm --filter @amanah/shared build && pnpm --filter @amanah/db build

# Runs as root deliberately: this is an ephemeral `--rm` one-shot the operator triggers
# manually; forge writes compile artifacts under /app and Foundry lives in /opt, so a
# non-root user would require chowning the whole tree for marginal benefit.
CMD ["bash", "scripts/seed-demo.sh"]
