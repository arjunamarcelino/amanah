---
title: "Seeded campaign invisible (active=false): the Prisma seed's upsert UPDATE branch didn't re-assert active=true, reintroducing the indexer-stub ordering bug the repository already fixed"
date: 2026-10-24
category: integration-issues
problem_type: logic_error
component: db
severity: blocking
status: resolved
symptoms:
  - "A newly seeded campaign never appears in the discover grid / console campaign tab"
  - "GET /campaigns omits the campaign; its row exists in Postgres with active=false"
  - "prisma db seed reports it upserted the campaign, yet the campaign stays hidden"
  - "Manually UPDATE active=true 'fixes' it, but a re-seed does not — the flag never flips"
  - "Only campaigns the indexer observed on-chain FIRST are affected; brand-new slugs seeded before any event are fine"
tags: [prisma, upsert, seed, indexer, active-flag, two-writer, ordering, on-conflict, base-sepolia, campaign-registered, parallel-write-path]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/16
  - commit: c2fcf8a  # fix(seed): activate seeded campaigns on the update path
  - files:
    - packages/db/prisma/seed.ts
    - packages/db/src/repository.ts
    - apps/indexer/src/handlers.ts
  - solution: docs/solutions/integration-issues/onchain-campaign-registration-indexer-registeredonchain.md
  - solution: docs/solutions/database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md
---

# The seed's `upsert` UPDATE branch silently dropped `active` — reviving an ordering bug the repository had already killed

## Problem

A campaign introduced via the offchain seed (`packages/db/prisma/seed.ts`) never showed up in the
discover grid or the console campaign tab. Its row was present in Postgres, but with `active=false`,
so `GET /campaigns` (which filters on `active`) excluded it. Re-running `prisma db seed` did **not**
fix it — the flag stayed `false` no matter how many times the seed ran.

The tell: this only happened for campaigns the **indexer had already observed on-chain** (it saw
`CampaignRegistered` and created a stub row) *before* the seed ran. A brand-new slug seeded before
any on-chain event worked fine.

## Root cause — `active` is offchain-owned, but two writers create the row, and Prisma's `upsert.update` is unconditional-but-only-what-you-list

`active` is an **offchain display flag owned by the seed/API**, not derived from chain state (unlike
`registeredOnChain`). But the `Campaign` row can be born from **either** of two writers, in either order:

1. **Indexer** — `upsertCampaignChainState` (`packages/db/src/repository.ts`) inserts a *stub* on
   `CampaignRegistered` with `registeredOnChain=true` **and `active=false`**:
   ```sql
   INSERT INTO "Campaign" (..., "registeredOnChain","active", ...)
   VALUES (..., true, false, now(), now())
   ON CONFLICT ("campaignId") DO UPDATE SET "registeredOnChain" = true, ...
   -- correctly NEVER touches the offchain-owned `active`
   ```
2. **Seed** — `prisma.campaign.upsert({ where, create, update })` with the descriptive metadata.

When the indexer wins the race, the seed hits its **`update`** branch. And Prisma's `update` branch
writes **exactly the keys you list and nothing else** — if `active` isn't in the object, the existing
`active=false` is left untouched:

```ts
// ❌ update branch omits `active` → a stub's active=false is never flipped
await prisma.campaign.upsert({
  where: { campaignId },
  update: { type, cause, name, country, releaseType, recipientOrg, goalBase },
  create: { campaignId, type, cause, name, country, releaseType, recipientOrg, goalBase, active: true },
});
```

The `create` branch set `active: true`, so it *looked* correct — but `create` only runs when no row
exists. Indexer-first → `update` runs → `active` stays `false` forever.

### Why this was a regression, not a new discovery

The repository's **API** write path (`upsertCampaignMetadata`) had **already solved this exact
ordering case** — its raw `ON CONFLICT ... DO UPDATE` explicitly re-asserts the flag:

```sql
ON CONFLICT ("campaignId") DO UPDATE SET
  ..., "active" = true, "updatedAt" = now()   -- "an API write is the activation signal"
```

The Prisma seed is a **separate, parallel write path** to the same table that did not carry the same
rule. Any time a second writer to a table is added through a different mechanism (raw repo fn vs.
`prisma.upsert`), the invariants enforced in the first writer do **not** come along for free.

## Solution

Add `active: true` to the seed upsert's **`update`** branch so the seed is an activation signal too,
matching the repository's API path (`c2fcf8a`):

```ts
await prisma.campaign.upsert({
  where: { campaignId },
  // `active` IS set here (offchain display flag the seed owns, NOT indexer-owned): if the indexer
  // created a stub first (active=false) the update path must still activate the campaign.
  update: { type, cause, name, country, releaseType, recipientOrg, goalBase, active: true },
  create: { campaignId, type, cause, name, country, releaseType, recipientOrg, goalBase, active: true },
});
```

Note the deliberate asymmetry with `registeredOnChain`: the seed sets `active` on **both** branches
(it owns it) but **never** writes `registeredOnChain` (indexer-owned — see the sibling doc). The
general fund stays `active:false` on purpose and is keyed separately, so it's unaffected.

## Prevention

- **Prisma `upsert.update` only writes the keys you list.** A field present in `create` but absent
  from `update` is silently preserved-as-is on conflict — which, for a row another writer may have
  created with a different value, means your intended value never lands. Audit `create`/`update`
  pairs for fields that must be *re-asserted*, not just *initialized*.
- **Every writer to a shared table must carry the same invariants.** When a column is "owned" by one
  side (here `active` = offchain-owned, `registeredOnChain` = indexer-owned), that ownership rule has
  to be encoded in *all* write paths — the raw repository fn **and** any `prisma.upsert` seed/script.
  Adding a parallel write mechanism is how a fixed bug comes back.
- **Reproduce the losing order, not just the happy path.** The seed-then-indexer order masks the bug;
  only indexer-then-seed exposes it. To test an idempotent writer against a row another writer may
  have created first, seed a stub with the adversarial value (`active=false`) *before* running the
  path under test.
- **Red flag phrase:** "the create branch sets it, so we're good." Create only runs when the row is
  absent. If any other code path can insert the row first, the `update` branch is the one that runs.

## Related

- Sibling ownership rule for the *other* flag (indexer-owned, must NOT be hand-set):
  [`onchain-campaign-registration-indexer-registeredonchain.md`](./onchain-campaign-registration-indexer-registeredonchain.md)
- Why the repository uses raw `ON CONFLICT ... DO UPDATE ... WHERE` instead of `prisma.upsert` for
  contended money tables (the same two-writer problem, one ratchet class harder):
  [`../database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md`](../database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md)
- PR [#16](https://github.com/arjunamarcelino/amanah/pull/16), fix commit `c2fcf8a`.
