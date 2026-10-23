# amanah

On-chain charitable disaster-relief protocol on Base Sepolia. Donations become a transparent, auditable pool; every money movement emits an on-chain event; parametric and milestone triggers release funds; an AI off-ramp router proposes payout rails for human approval; and idle principal earns yield for the cause. **One engine, any cause or disaster.**

## Hero features

1. **Parametric auto-release** — a disaster trigger (e.g. a Philippines typhoon threshold) fires an on-chain release via `ReleaseController.fire()`. No committee, no delay: the condition is the authorization.
2. **AI off-ramp routing** — given an amount + country, the agent picks the best payout rail (fees, liquidity, ETA) and returns a decision for human approval, with a deterministic lowest-fee fallback when the model is unavailable.
3. **Idle-yield on pooled donations** — `CharityPool.investIdle()` deploys idle base (above a liquidity buffer) into a yield adapter, with an optional halal-only mode, so waiting funds still work for the cause.

## Architecture

```
                              Internet (TLS)
                                    │
                          ┌─────────▼──────────┐
                          │   Caddy (80/443)   │  automatic HTTPS
                          │  amanah.help        │
                          └──┬───────┬───────┬──┘
          amanah.help ───────┘  app. │       │ api.
                 │                   │       │
          ┌──────▼──────┐   ┌────────▼───┐  ┌▼─────────────┐
          │  landing    │   │    web     │  │     api      │
          │ (static,    │   │ Next.js 15 │  │  NestJS REST │
          │  Caddy srv) │   │  standalone│  │  (offchain)  │
          └─────────────┘   └─────┬──────┘  └──┬───────────┘
                                   │ server     │
                                   │ route      │  Prisma
                            ┌──────▼──────┐     │
                            │   agent     │  ┌──▼──────────┐   ┌───────────┐
                            │  Fastify    │  │  postgres   │◀──│  indexer  │
                            │ (internal,  │  │  (volume)   │   │  viem     │
                            │  Claude)    │  └─────────────┘   │  worker   │
                            └─────────────┘                    └─────┬─────┘
                                                                     │ reads events
                              Base Sepolia (contracts — NOT containerized)
                    CharityPool · ReleaseController · PayoutRouter · mocks
```

The off-ramp **agent is internal-only** — reached by `web`/`api` over the compose network behind a shared-secret bearer gate (`AGENT_SHARED_SECRET`), never proxied by Caddy, because every `/route` call makes a paid Claude request (exposing it publicly would be a denial-of-wallet target).

## Monorepo

pnpm + Turborepo, Node 22.

```
apps/
  web/       @amanah/web      — Next.js dApp (donor flow, console, ledger)
  landing/   @amanah/landing  — marketing site (static export)
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
cd packages/contracts && forge build && forge test
```

## Deploy to the VPS (Docker)

Contracts are already live on Base Sepolia (addresses below); only the services are containerized.

```bash
# 1. DNS: point A records at the VPS — amanah.help, www., app., api.
# 2. Open ports 80 and 443; nothing else may bind them.
# 3. Dynamic dashboard: enable Base Sepolia (testnets) + embedded wallets, and add
#    https://app.amanah.help (+ https://amanah.help) to allowed origins.
# 4. On the VPS, clone the repo and set the stack env:
git clone <repo> /srv/amanah && cd /srv/amanah
cp docker-compose.example.env .env   # then edit .env with real values
#    - POSTGRES_PASSWORD, ANTHROPIC_API_KEY (set a spend cap in the Anthropic console)
#    - AGENT_SHARED_SECRET=$(openssl rand -hex 32)  (same value feeds web + agent)
#    - CORS_ORIGINS=https://app.amanah.help
#    - DEPLOYER_PRIVATE_KEY (funded Base Sepolia owner key — testnet/mock only)
#    - NEXT_PUBLIC_*  (baked into the web/landing images at build time)
# 5. Bring it up (migrate runs before api/indexer; Caddy obtains TLS):
docker compose up -d --build

# From your laptop you can also run:  VPS_HOST=user@amanah.help pnpm deploy
```

> `NEXT_PUBLIC_*` are inlined into the web/landing images at **build** time (they also feed the web CSP `connect-src` allowlist). Changing the api/app/rpc domain therefore requires a full **rebuild** (`--build`) — a plain restart keeps stale values and will CSP-block the new origin. `deploy.sh` always rebuilds.

## Contract deploy (only if redeploying)

```bash
cd packages/contracts
forge script script/Deploy.s.sol:Deploy --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
node script/export-shared.mjs   # regenerate @amanah/shared addresses/ABIs
```

## Seed the demo

```bash
pnpm seed:demo   # one-shot: on-chain register (×2) + donation + investIdle, then offchain metadata/rails
```

Idempotent and preflight-guarded (fails loud if the deployer key is underfunded). It leaves the PARAMETRIC flagship **armed** — fire it live in the demo.

## 90-second demo runbook (Philippines typhoon)

1. **Browse** `https://app.amanah.help` — the seeded flagship (PH typhoon) is featured; the "same engine, any cause" section shows the breadth.
2. **Donate** to the flagship — gasless, any mock stablecoin; the donation appears on `/ledger` as a real on-chain row (seeded close to demo time; `INDEXER_CONFIRMATIONS` is low in the demo env so it surfaces fast).
3. **Route** the payout — the AI off-ramp router proposes the best rail (live Claude call; deterministic fallback if unavailable).
4. **Fire the trigger** — from the operator console, fire the typhoon parametric trigger → the on-chain release happens live, visible in the ledger. (Idle-yield from `investIdle` is already reflected.)

## Real vs mocked (honesty note)

- **Real:** all contracts on Base Sepolia; donations, releases, and `investIdle` are genuine on-chain txs; the indexer mirrors real events; the agent makes real Claude calls.
- **Mocked (testnet):** the stablecoins (`mUSDC`/`mXSGD`/`mIDRX`) have a **public mint** and the yield vaults are mocks — anyone on Base Sepolia can mint test tokens and `donate()`, so the live ledger may show third-party testnet rows during the demo window.
- **Payout rails** (GCash, GoPay, …) are a catalog for routing; no real fiat moves.
- **Web CSP** ships as **Report-Only** (does not block) and the landing CSP allows inline scripts — don't read these as hardened XSS protection for the demo.

## Deployments

| Subdomain | Service | URL |
|---|---|---|
| apex | landing | https://amanah.help |
| app. | web dApp | https://app.amanah.help |
| api. | REST API | https://api.amanah.help |
| agent | off-ramp router | internal-only (not publicly routed) |

**Base Sepolia (chainId 84532)** — startBlock `48377014`:

| Contract | Address |
|---|---|
| CharityPool | `0xc63596dFAE077e653A8b05bb516eD2856932695a` |
| ReleaseController | `0xE73Aa0991C89A1DaCC7588ab74A3214355695D47` |
| PayoutRouter | `0xC3F5Efd3128a61CC65f6d3B1237b7423D3082bDA` |
| mUSDC | `0xB30e054557533f28753B4ACdf646B393E2072bf9` |
| mXSGD | `0x3ca2d854D5f042dd0ddd39Eaf80644be0e80048c` |
| mIDRX | `0x959DaC1E9Ef51d4837C53C189a34641CE1a6f046` |
| MockSwap | `0xe526EDacf58Be80f959504b9D0687f82d4ebBaCa` |
| MockYieldVault | `0x46c504396857f9c67d0db8229DE50d112aec4cf7` |
| MockHalalVault | `0x15b248cD7939a4b9E1f6c06AC91D53d04B9ccB3B` |

**Demo video:** _TODO — add link after recording._

> `v1.0-demo` captures source + the committed `deployments/84532.json` + docs. It cannot capture the gitignored VPS `.env` (secrets), the built images, Postgres data, or minted balances — a reviewer must supply those. Rollback is code/image only (`git checkout <tag>` + rebuild); on-chain state and applied migrations are forward-only.
