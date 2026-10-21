# amanah

On-chain charitable disaster-relief protocol on Base Sepolia — donations become a transparent, auditable pool; every money movement emits an on-chain event, and an AI off-ramp router proposes payout rails for human approval.

## Monorepo

pnpm + Turborepo, Node 22.

```
apps/
  web/       @amanah/web      — Next.js dApp (donor flow, console, ledger)
  landing/   @amanah/landing  — marketing site (static)
  api/       @amanah/api      — NestJS REST API, offchain operational data only
  indexer/   @amanah/indexer  — viem worker mirroring on-chain events into Postgres
  agent/     @amanah/agent    — Fastify AI off-ramp router (Claude)
packages/
  contracts/ @amanah/contracts — Foundry (Solidity) smart contracts
  shared/    @amanah/shared    — zod schemas, types, chain constants, ABIs, addresses
  db/        @amanah/db        — Prisma client (PostgreSQL)
  ui/        @amanah/ui        — shadcn/ui component library
  config/    @amanah/config    — shared tsconfig / eslint / prettier
```

On-chain contracts are the source of truth for money. `apps/api` stores **offchain operational data only** — never financial state.

## Develop

```bash
pnpm install
pnpm turbo run build     # build all packages + apps
pnpm turbo run dev       # run all in watch mode

# contracts
cd packages/contracts && forge build && forge test
```

## Deployments (TBD)

Docker on a VPS (not Vercel). Each app ships its own Dockerfile; `docker-compose.yml` orchestrates all services + Postgres behind a Caddy reverse proxy (subdomains for landing / app / api). The off-ramp agent is **internal-only** — reached by api/web over the compose network behind a shared-secret bearer gate (`AGENT_SHARED_SECRET`), never publicly proxied, since every `/route` call makes a paid Claude request. URLs to be filled in once provisioned.
