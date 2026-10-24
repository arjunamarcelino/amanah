---
title: "Campaign shows 'isn't open for donations yet': registeredOnChain is indexer-owned, set only by an on-chain CampaignRegistered event"
date: 2026-10-23
category: integration-issues
problem_type: configuration
component: apps/web
severity: blocking
status: resolved
symptoms:
  - "Donate page is gated: 'This campaign isn't open for donations yet' for every seeded campaign"
  - "GET /campaigns returns registeredOnChain=false even though the offchain seed ran and active=true"
  - "Flipping registeredOnChain=true directly in Postgres 'opens' the gate but is a fake — it's not backed by on-chain state"
  - "ReleaseController.campaignInfo(campaignId) returns registered=false on Base Sepolia"
tags: [base-sepolia, indexer, registeredOnChain, release-controller, campaign-registered, prisma, seed, donor-gate, foundry, cast, local-stack]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/12
  - files:
    - apps/web/app/(wallet)/donate/[campaignId]/page.tsx
    - packages/contracts/src/release/ReleaseController.sol
    - packages/contracts/script/DemoSeed.s.sol
    - apps/indexer/src/handlers.ts
    - packages/db/src/repository.ts
    - packages/db/prisma/seed.ts
---

# `registeredOnChain` is indexer-owned — the donor gate reflects real chain state

The donate page gates before any wallet interaction (`apps/web/app/(wallet)/donate/[campaignId]/page.tsx`):

```tsx
if (!campaign.active) return <Blocked title="This campaign is not active" />;
if (!campaign.registeredOnChain)
  return <Blocked title="This campaign isn't open for donations yet" />;
```

After seeding, every campaign showed the second block. The instinct — `UPDATE "Campaign" SET
"registeredOnChain" = true` — opens the gate but is a **fake**: the flag no longer reflects chain
reality, and `ReleaseController.campaignInfo(id)` still returns `registered=false`.

## Root cause

`registeredOnChain` is a **derived, indexer-owned** flag, by design:

- The **only** writer of `registeredOnChain = true` is the indexer's
  `upsertCampaignChainState` (`packages/db/src/repository.ts`), called from
  `apps/indexer/src/handlers.ts` on the `CampaignRegistered` event.
- That event is emitted **only** by `ReleaseController.registerCampaign(campaignId, releaseType)`
  (`onlyOwner`), where `campaignId = keccak256(bytes(slug))`.
- The **offchain seed deliberately leaves it `false`** (`packages/db/prisma/seed.ts` sets
  descriptive metadata + `active=true`, never the indexer-owned flag). The API mapper likewise
  never sets it — it's filled when the chain event is observed.

So a campaign is "open" only once it is **actually registered on-chain** and the indexer has
observed the event. No amount of DB editing is legitimate.

## Solution — register on-chain, then let the indexer set the flag

Contracts were already deployed on Base Sepolia (84532); only registration + indexing were missing.

### 1. Register each campaign on-chain (owner key)

`registerCampaign` is `onlyOwner`, so use the deployer/owner key (the contracts' owner). The
`DemoSeed.s.sol` script registers the 2 flagship campaigns; to register all of them, call
`registerCampaign` directly. `ReleaseType` enum: `PARAMETRIC=0`, `MILESTONE=1`.

```bash
# packages/contracts/.env holds BASE_SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY (owner)
set -a; . packages/contracts/.env; set +a
RC=0xE73Aa0991C89A1DaCC7588ab74A3214355695D47   # ReleaseController
for item in "ph-typhoon-2025:0" "id-rural-school-supplies:1" "clinic-medicine-fund:1" "masjid-waqf:1"; do
  slug="${item%%:*}"; rt="${item##*:}"
  cast send "$RC" "registerCampaign(bytes32,uint8)" "$(cast keccak "$slug")" "$rt" \
    --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$BASE_SEPOLIA_RPC_URL"
done
```

Verify on-chain (don't trust the DB): `cast call $RC "campaignInfo(bytes32)(bool,uint8)"
$(cast keccak "ph-typhoon-2025") --rpc-url $RPC` → `true 0`.

### 2. Run the indexer so it writes the real flag

Reset any manual flip to `false` first, so the value you see is genuinely indexer-produced:

```bash
docker exec <pg> psql -U amanah -d amanah -c 'UPDATE "Campaign" SET "registeredOnChain"=false;'
```

Then run the indexer pointed at Base Sepolia. Start just before the registration blocks and lower
confirmations so the backfill is seconds, not minutes (default start is the deploy block, ~678k
blocks back):

```bash
DATABASE_URL=... BASE_SEPOLIA_RPC_URL=... \
INDEXER_START_BLOCK=<just-before-registration> INDEXER_CONFIRMATIONS=2 \
pnpm --filter @amanah/indexer dev
```

The indexer observes `CampaignRegistered` and upserts `registeredOnChain=true`. `GET /campaigns`
then serves the real flag and the donate gate opens.

## Local-stack caveats (bringing the demo up)

- **Run Postgres on a free port.** The compose Postgres isn't published; a standalone container on
  `127.0.0.1:5433` avoids colliding with a host Postgres already on 5432.
- **Each app needs its own env:** api (`DATABASE_URL`, `CORS_ORIGINS=http://localhost:3000`, `PORT`),
  web (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`), indexer (`DATABASE_URL`,
  `BASE_SEPOLIA_RPC_URL`, `INDEXER_START_BLOCK`, `INDEXER_CONFIRMATIONS`).
- **DB bring-up:** `prisma generate` → `prisma migrate deploy` → `prisma db seed` (writes campaign
  metadata + rails; leaves `registeredOnChain=false`).

## Prevention

- **Never hand-edit indexer-owned columns to pass a gate.** `registeredOnChain` (and `active`'s
  on-chain truth) is derived from events; a manual flip diverges from `campaignInfo` and will mislead.
  Treat the DB flag as a cache of chain state.
- **To "open" a campaign for a demo, register it on-chain** (`registerCampaign` as owner) and run the
  indexer — the flag follows. `DemoSeed.s.sol` only registers 2 of the seeded campaigns; the rest
  need explicit `registerCampaign` calls or a script extension.
- **`campaignId = keccak256(bytes(slug))`** everywhere — the TS `campaignIdFromSlug`, the Prisma seed,
  and `cast keccak "<slug>"` must agree (locked by `SlugParity.t.sol`).
- **Shrink indexer backfill for local runs** with `INDEXER_START_BLOCK` near the event and
  `INDEXER_CONFIRMATIONS=2`, instead of replaying from the deploy block.

## Related

- PR [#12](https://github.com/arjunamarcelino/amanah/pull/12)
- The *offchain-owned* sibling flag `active` has the mirror-image ordering trap — the seed must
  re-assert it on the upsert UPDATE branch or an indexer-first stub stays `active=false`:
  [`seed-upsert-update-branch-drops-active-flag.md`](./seed-upsert-update-branch-drops-active-flag.md)
- Indexer reading events over a public RPC:
  [`browser-reading-unindexed-events-public-rpc.md`](./browser-reading-unindexed-events-public-rpc.md)
- Prisma upsert / on-conflict pattern the flag-writer relies on:
  [`../database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md`](../database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md)
