# Amanah — judge handout

One platform, any cause or disaster. On-chain charitable relief on Base Sepolia: transparent pooled donations, parametric + milestone release, AI off-ramp routing, and idle-yield.

## The 3 hero features

1. **Parametric auto-release** — a disaster trigger fires an on-chain release (`ReleaseController.fire()`); the condition is the authorization.
2. **AI off-ramp routing** — the agent picks the best payout rail for an amount + country, with a deterministic fallback.
3. **Idle-yield** — pooled donations above a liquidity buffer earn yield (`investIdle`), with an optional halal-only mode.

## Live

| | URL |
|---|---|
| Landing | https://amanah.help |
| App (dApp) | https://app.amanah.help |
| API | https://api.amanah.help |
| Agent | internal-only (not publicly routed — paid Claude endpoint) |

**Demo video:** _TODO — add link after recording._

## Watch it work

The full **90-second demo runbook** lives in the [README](./README.md#90-second-demo-runbook-philippines-typhoon): browse → donate → route → fire the typhoon trigger live. The seed (`pnpm seed:demo`) primes everything and leaves the parametric campaign **armed** for the live fire.

## What's real vs mocked

See the [README honesty note](./README.md#real-vs-mocked-honesty-note). Short version: contracts, donations, releases, `investIdle`, and the agent's Claude calls are **real** on Base Sepolia; the stablecoins/vaults are **mocks** (public mint, so third-party testnet rows can appear), payout rails are a routing catalog (no real fiat), and the web CSP is Report-Only.

## Pre-deploy checklist (operator)

- DNS A records for `amanah.help`, `www.`, `app.`, `api.` → VPS; ports 80/443 open.
- Privy dashboard lists `https://app.amanah.help`.
- VPS `.env`: `CORS_ORIGINS=https://app.amanah.help`; `AGENT_SHARED_SECRET` (`openssl rand -hex 32`, same for web + agent); funded `DEPLOYER_PRIVATE_KEY`; `ANTHROPIC_API_KEY` **with a console spend cap**; `POSTGRES_PASSWORD`; all `NEXT_PUBLIC_*`.

## Operating notes

- A `NEXT_PUBLIC_*` change requires `docker compose up -d --build` (baked into the image + CSP at build time).
- `DEPLOYER_PRIVATE_KEY` is the contract **owner** key — testnet/mock only; **never reuse on mainnet**.
- Migrate failure (P3009): `docker compose run --rm migrate pnpm --filter @amanah/db exec prisma migrate resolve --applied <name>`.
- `v1.0-demo` captures source + committed addresses + docs — **not** secrets, images, DB data, or minted balances. Rollback is code/image only; on-chain state and migrations are forward-only.
