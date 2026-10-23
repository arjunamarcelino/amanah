---
title: "Dockerizing a pnpm/turbo monorepo for VPS deploy (turbo prune, Next standalone, Prisma, Caddy, one-shot migrate)"
date: 2026-10-23
category: build-errors
problem_type: build_failure
component: docker
severity: blocking
status: resolved
symptoms:
  - "pnpm install --frozen-lockfile aborts in a turbo-pruned image: ERR_PNPM_LOCKFILE_CONFIG_MISMATCH"
  - "web dApp boots with empty NEXT_PUBLIC_* (Privy won't init, API calls go to \"\", CSP connect-src omits the API origin)"
  - "api/indexer crash-loop on first boot against an empty database (no schema)"
  - "prisma migrate deploy fails in the runner: prisma: command not found, or wrong query-engine binary for the platform"
  - "docker compose up fails pulling amanah-api:local (manifest unknown) when the migrate one-shot runs before api is built"
  - "seed container exits immediately: forge: No such file or directory (musl/glibc loader mismatch)"
  - "unauthenticated POST endpoint that triggers a paid LLM call is rate-limited on a spoofable header (denial-of-wallet)"
tags: [docker, docker-compose, turbo, turbo-prune, pnpm, catalog, monorepo, nextjs, standalone, prisma, binary-targets, caddy, tls, foundry, foundryup, vps, deployment, denial-of-wallet, xff, rate-limit]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/11
  - commit-dockerfiles: cdb320e
  - commit-compose: 0fb321e
  - commit-turbo-pin: d5cca54
  - commit-standalone: f3795db
  - commit-prisma-targets: 081bc5e
  - commit-xff-fix: 375af3b
  - commit-foundryup-seed: bccbe48
  - commit-migrate-build: f5b0e02
  - see-also: build-errors/turbo-monorepo-ci-forge-and-eslint-flat-config.md
  - see-also: build-errors/nextjs-static-export-fonts-metadata-and-headers.md
  - see-also: build-errors/cjs-nestjs-consuming-esm-workspace-package.md
  - see-also: integration-issues/privy-wagmi-nextjs15-app-router-build-and-prerender.md
---

# Dockerizing a pnpm/turbo monorepo for VPS deploy

Containerizing the Amanah monorepo (Next.js web + static landing + NestJS api + Fastify agent + viem indexer + Postgres) behind Caddy on a single VPS surfaced a cluster of build/runtime gotchas. Each is independent and individually reusable; they bit (or would have bitten) a first `docker compose up -d --build` on a fresh host. Stack: pnpm@10.29.2, Turborepo 2.11.x, Node 22 (`node:22-slim`, Debian bookworm), Prisma 6, Foundry, Base Sepolia.

> **Scope note:** this documents *containerization + deploy wiring*, not product logic. The on-chain contracts were already deployed; only the services were dockerized.

---

## Gotcha 1 — `turbo prune` + pnpm `catalog:` → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

**Symptom.** In the installer stage of a `turbo prune --docker` build, `pnpm install --frozen-lockfile` aborts with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

**Root cause.** The repo pins `zod`/`viem` via a pnpm **catalog** (`pnpm-workspace.yaml`). On turbo `< 2.11.8`, `turbo prune` rewrites the pruned `pnpm-lock.yaml` but drops the catalog config block (and other unknown lockfile settings), so `--frozen-lockfile` sees a mismatch and refuses.

**Fix.**
1. Use turbo **≥ 2.11.8** for the prune ([turbo #14376](https://github.com/vercel/turborepo/pull/14376)). Pin it in root `package.json` (`"turbo": "^2.11.8"`) so a fresh install can't regress.
2. Install turbo **globally in the prune stage** — prune runs *before* workspace deps exist, so the workspace turbo isn't available yet:
   ```dockerfile
   FROM base AS prune
   RUN pnpm add -g turbo@2.11.9     # pinned; catalog-safe
   COPY . .
   RUN turbo prune @amanah/web --docker
   ```
   `turbo prune --docker` emits `out/json/` (manifests + lockfile + `pnpm-workspace.yaml` — the catalog lives here, so it must be present) and `out/full/` (source). Install order is the whole point of the layer cache:
   ```dockerfile
   FROM base AS installer
   COPY --from=prune /app/out/json/ .
   RUN pnpm install --frozen-lockfile      # cached unless a manifest/lockfile changes
   FROM installer AS builder
   COPY --from=prune /app/out/full/ .
   RUN pnpm turbo run build --filter=@amanah/web
   ```

---

## Gotcha 2 — `NEXT_PUBLIC_*` are inlined at BUILD time → must be Docker build ARGs

**Symptom.** The deployed web/landing images serve with empty `NEXT_PUBLIC_*` values — Privy won't initialize, API calls hit `""`, and (for this repo) the CSP `connect-src` computed in `next.config.mjs` omits the API/RPC origins.

**Root cause.** Next inlines `process.env.NEXT_PUBLIC_*` into the client bundle (and any config computed at build) during `next build`. Setting them as runtime container env does nothing for client code.

**Fix.** Pass them as Docker `ARG`→`ENV` *before* `next build`, fed from compose `build.args`:
```dockerfile
FROM installer AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=@amanah/web
```
```yaml
web:
  build:
    args:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:?}
      NEXT_PUBLIC_PRIVY_APP_ID: ${NEXT_PUBLIC_PRIVY_APP_ID:?}
```
**Consequences to document for operators:** values are *baked into the image* and visible in the shipped JS — never put secrets in `NEXT_PUBLIC_*`; server-only values (e.g. `AGENT_URL`, `AGENT_SHARED_SECRET`) stay as runtime `environment:`; and **changing a public var requires a rebuild** (`--build`), not a restart — a plain restart silently keeps stale values and will CSP-block the new origin. (turbo passes `NEXT_PUBLIC_*` through its default strict envMode, verified with turbo 2.11.9.)

---

## Gotcha 3 — Prisma 6 on `node:22-slim`: wrong engine + missing CLI in the runner

**Symptoms.** `Prisma Client was generated for "debian-openssl-1.1.x", but the deployment required "debian-openssl-3.0.x"`; or `prisma: command not found` when the one-shot migrate service runs `prisma migrate deploy`.

**Root causes & fixes.**
- `node:22-slim` is Debian **bookworm** (OpenSSL 3). Declare the Linux target so `prisma generate` emits the right engine alongside `native`:
  ```prisma
  generator client {
    provider      = "prisma-client-js"
    binaryTargets = ["native", "debian-openssl-3.0.x"]
  }
  ```
- Install `openssl ca-certificates` in any image that loads the engine (api, indexer, migrate), and run `prisma generate` **at build** (the generated client is gitignored, so it isn't in `out/full/`).
- **The migrate one-shot needs the prisma *CLI*, which is a `devDependency`.** A pruned prod-only runner won't have it. The fix is to run `pnpm install --frozen-lockfile` **without `--prod`** and copy the whole built workspace into the runner (the official Turborepo pnpm pattern), so the CLI + `@prisma/engines` + the pnpm symlink farm + `schema.prisma` + `prisma/migrations/` all survive. Then `pnpm --filter @amanah/db exec prisma migrate deploy` resolves.
- Dual-build must **clean first**: `rm -rf dist && prisma generate && tsc && cp -R src/generated dist/generated` (a second build otherwise nests `dist/generated/generated`).

---

## Gotcha 4 — First-boot DB race → one-shot `migrate` service with health gating

**Symptom.** `api`/`indexer` crash-loop on an empty volume because they connect before the schema exists.

**Fix.** A dedicated one-shot `migrate` service runs `prisma migrate deploy` after Postgres is healthy; dependents gate on its clean completion:
```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U amanah -d amanah"]
migrate:
  image: amanah-api:local
  build: { context: ., dockerfile: docker/api.Dockerfile }   # self-sufficient (see below)
  command: ["pnpm", "--filter", "@amanah/db", "exec", "prisma", "migrate", "deploy"]
  depends_on: { postgres: { condition: service_healthy } }
  restart: "no"
api:
  depends_on:
    postgres: { condition: service_healthy }
    migrate:  { condition: service_completed_successfully }
```
**Two sub-traps:**
- Give `migrate` its **own `build:` block** (same as `api`) rather than only `image: amanah-api:local` with no build. Compose dedupes identical builds to one image, but without a `build:` any path that doesn't build `api` first (`docker compose run --rm migrate …`, `up migrate`, `pull`) fails with "manifest unknown" — and that `run --rm migrate …` is exactly the P3009 recovery command.
- **P3009 recovery:** a single transactional DDL migration that fails mid-apply **rolls back fully** (no tables). Recover with `prisma migrate resolve --rolled-back <name>` so the next deploy re-applies it. Using `--applied` marks a non-existent schema as present → the app starts against an empty DB (a worse, silent failure). Only use `--applied` for a hand-finished partial apply.

---

## Gotcha 5 — Next.js `output: 'standalone'` in a monorepo

**Fix.** Set it with the tracing root at the repo root so the standalone bundle mirrors the monorepo layout:
```js
// apps/web/next.config.mjs
import { fileURLToPath } from "node:url"; import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = { output: "standalone", outputFileTracingRoot: path.join(__dirname, "../../"), transpilePackages: ["@amanah/ui", "@amanah/shared"] };
```
Runner copies exactly three things, and **`apps/web/public` must exist** (an empty `.gitkeep` is enough) or the `COPY` fails the build:
```dockerfile
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
ENV HOSTNAME=0.0.0.0 PORT=3000      # or the server binds localhost and is unreachable
CMD ["node", "apps/web/server.js"]
```

---

## Gotcha 6 — Caddy automatic TLS + shared security-header snippet

Use **managed certs** (not On-Demand) for a fixed subdomain set, a global ACME `email`, and persist `caddy_data`. Put edge security headers in a `(secure_headers)` snippet and `import` it — don't *also* set the same headers in `next.config.mjs`, or the dApp ships **duplicate/conflicting** headers (two HSTS lines, preload vs no-preload). Keep CSP-Report-Only in Next (Caddy can't templatize it easily); let Caddy own HSTS/XFO/nosniff/Referrer. Validate Caddyfiles with a real `caddy validate` before deploy — `file_server { status 404 }` forces a true 404 on a branded error page (otherwise it's a soft-200).

DNS A records for every host + ports 80/443 must exist *before* first boot; do the first issuance against the LE **staging** CA (`acme_ca`) then flip to prod to avoid the 5-fails/host/hour lockout.

---

## Gotcha 7 — Seed/tool image: don't copy Foundry binaries across libc; use `foundryup`

**Symptom.** A seed container that `COPY --from=ghcr.io/foundry-rs/foundry`-copies `forge`/`cast` into `node:22-slim` exits with a loader error (`No such file or directory`) — musl binaries can't run on Debian/glibc.

**Fix.** Install Foundry *in* the image with `foundryup` so binaries match the platform; pin a channel/version for reproducibility:
```dockerfile
ENV FOUNDRY_DIR=/opt/foundry
ENV PATH="$FOUNDRY_DIR/bin:$PATH"
RUN curl -L https://foundry.paradigm.xyz | bash && foundryup -i stable && forge --version
```

---

## Gotcha 8 — Denial-of-wallet: rate-limit on the RIGHTMOST `X-Forwarded-For` behind a proxy

**Symptom.** An unauthenticated endpoint that triggers a paid LLM call is "rate limited," but an attacker sends unlimited accepted requests.

**Root cause.** The limiter keyed on `xff.split(",")[0]` — the **leftmost** XFF entry, which is client-controllable. Caddy (one hop) *appends* the real client IP on the right, so a spoofed `X-Forwarded-For: evil` arrives as `evil, <realIP>` and the leftmost value defeats the limiter.

**Fix.** Key on the **rightmost** entry (matches `trust proxy 1`), and set a hard spend cap on the API key as the real backstop (any per-IP limit is botnet-bypassable):
```ts
const xff = request.headers.get("x-forwarded-for");
const ip = (xff?.split(",").pop() ?? "unknown").trim() || "unknown";
```
Also keep the service `expose`-only (no host port) so it's reachable solely via the proxy — an attacker can't hit it directly to inject a forged rightmost IP.

---

## Prevention / checklist for the next monorepo dockerization

- [ ] turbo `≥ 2.11.8` pinned; turbo installed globally in the prune stage.
- [ ] Every `NEXT_PUBLIC_*` is a `build.arg` (never runtime); secrets only in `environment:`; `deploy.sh` always `--build`.
- [ ] `schema.prisma` has the Linux `binaryTargets`; runner installs `openssl`; prisma CLI survives into the migrate image (non-`--prod` install + copy the whole workspace).
- [ ] One-shot `migrate` with its own `build:`, gated on `postgres: service_healthy`; dependents gate on `migrate: service_completed_successfully`; P3009 runbook uses `--rolled-back`.
- [ ] `output: 'standalone'` + `outputFileTracingRoot`; `public/` exists; `HOSTNAME=0.0.0.0`.
- [ ] Caddy: managed certs, ACME email, persisted `caddy_data`, DNS + 80/443 first, staging-CA dry run; security headers from one source; `caddy validate` in review.
- [ ] Tool images install native toolchains (foundryup), never copy binaries across libc.
- [ ] Proxy-fronted rate limiters key on the rightmost XFF; paid keys have a provider spend cap.
- [ ] Validate what the daemon can't build locally: `docker compose config`, `caddy validate`, and reproduce `turbo prune` layout with the pinned turbo.
