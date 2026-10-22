---
title: "Reading un-indexed contract events in the browser over a public RPC (resumable getLogs)"
date: 2026-10-23
category: integration-issues
problem_type: logic_error
component: apps/web
severity: non-blocking
status: resolved
symptoms:
  - "A public /ledger page that reads chain events directly is slow on first load and sometimes never populates the chain rows"
  - "`getLogs`/`getContractEvents` over a fixed deploy block (START_BLOCK) to latest fails or stalls against the public Base Sepolia RPC"
  - "A single transient RPC error re-runs the ENTIRE historical scan from START_BLOCK (react-query retries 3×), amplifying load on the public endpoint"
  - "Open ledger tab grows memory/DOM without bound; the same payout renders a different amount depending on whether it came from the API or the chain"
tags: [viem, getlogs, getcontractevents, public-rpc, base-sepolia, react-query, ledger, chunking, cursor, localstorage, bundle, nextjs, unindexed-events]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/10
  - files:
    - apps/web/lib/ledger.ts
    - apps/web/components/ledger/LedgerFeed.tsx
    - apps/web/components/ledger/LedgerRow.tsx
    - packages/shared/src/ledger.ts
---

# Reading un-indexed contract events in the browser over a public RPC

The glass-box `/ledger` page is wallet-free and reads some events **straight from chain** —
specifically the three the indexer does NOT project (`Invested`, `YieldAccrued`,
`SukukYieldAccrued`) — then merges them with the cached API index. Doing that correctly from a
browser, against a shared public RPC (`sepolia.base.org`), has several non-obvious traps. This is
the playbook; most of it was caught in code review, not at build time.

## 1. A single wide `getLogs` from a fixed deploy block does not scale — and fails outright

`START_BLOCK` is a constant (the deploy block) while the head advances ~43,200 blocks/day. Base's
public RPC caps `eth_getLogs` at ~10k blocks per call, so a `fromBlock: START_BLOCK, toBlock:
"latest"` request fails, and even chunked it is ~(head − START_BLOCK)/9000 sequential calls that
only **grows** over time (~4.7 windows/day). On first load that was ~141 `getLogs` for us.

Use fixed 9k-block windows behind an **incremental cursor**, and prefer `getContractEvents`
(typed `args` from an `as const` ABI, `strict: true`, literal `eventName`) over raw `getLogs`.

## 2. The real bug: all-or-nothing scanning + react-query retry = full re-scan storm

The subtle defect (review-caught): advancing the cursor and writing the cache only **after**
`Promise.all` of every window resolves. If any one window throws, the whole function rejects, the
cursor stays `null`, and react-query's default `retry: 3` re-runs the entire cold scan — on a flaky
public RPC across ~141 calls, at least one failure is likely, so full re-scans become the common
case, not the exception.

**Fix — make the scan resumable and non-throwing:**

```ts
// apps/web/lib/ledger.ts
const WINDOW = 9_000n;
const REORG_BUFFER = 15n;            // don't scan the last ~30s (OP-stack reorg bound)
let cursor: bigint | null = null;     // module singleton (see §4)
let cache: LedgerEntry[] = [];
let inflight: Promise<LedgerEntry[]> | null = null;

export async function fetchChainEvents(): Promise<LedgerEntry[]> {
  if (inflight) return inflight;                    // coalesce concurrent callers (§4)
  hydrateFromStorage();                             // amortize cold scan across loads (§3)
  inflight = (async () => {
    const head = await publicClient.getBlockNumber();
    const safeHead = head > REORG_BUFFER ? head - REORG_BUFFER : head;
    let from = cursor === null ? BigInt(START_BLOCK) : cursor + 1n;
    while (from <= safeHead) {
      const to = from + WINDOW - 1n < safeHead ? from + WINDOW - 1n : safeHead;
      let rows: LedgerEntry[];
      try {
        rows = await scanWindow(from, to);
      } catch (err) {
        console.error("[ledger] window failed; will resume next poll", err);
        break;                                      // KEEP progress; return partial cache
      }
      cache = cache.concat(rows);
      cursor = to;                                  // advance PER successful window
      from = to + 1n;
    }
    persist();
    return cache;
  })();
  try { return await inflight; } finally { inflight = null; }
}
```

Because a failed window `break`s and returns the partial cache instead of throwing, react-query
sees success (no retry storm) and the next poll resumes from `cursor`. Also lower the query's
`retry` to 1 — belt and suspenders.

## 3. Persist the cursor + cache (amortize the cold scan)

A fixed deploy-block scan is inherently expensive once. Persist `{ cursor, cache }` to
`localStorage` (stringify the `bigint` cursor; `LedgerEntry` is already JSON-safe) and hydrate
once per browser, so the cold scan is paid once, not on every page load. Guard SSR
(`typeof window !== "undefined"`) and treat a corrupt entry as a cold start.

## 4. The module-singleton cursor/cache needs an in-flight guard — don't lean on react-query dedup

`cursor`/`cache` are module-global. If correctness relies on "exactly one serialized caller", that
invariant is invisible and only held today because react-query dedupes the single
`["ledger","chain"]` key. A second caller (new query key, non-react-query consumer) would both
observe `cursor === null` and double-scan/double-append. Enforce it locally with an in-flight
promise latch (the `if (inflight) return inflight` above), not an assumed external invariant.

## 5. Decimal parity: the same payout must render identically from both sources

API ledger amounts arrive as **base-units decimal strings**; chain amounts are **bigint** base
units. A single formatter only produces identical output if both go through `BigInt(...) →
formatTokenAmount` (one shared 6-dec formatter — do not introduce a second). Unit-test it: an API
`"100000000"` and a chain `100000000n` must both render `"100"`.

## 6. Keep the public read page wallet-free, and validate what the unauthenticated API returns

- Use a **standalone** viem `createPublicClient` (no wagmi/Privy import) so `/ledger` stays
  wallet-free and lean.
- Dedup the merge on `(txHash, logIndex)`; sort with the **same** comparator the API uses (extract
  `ledgerSort` to the shared package so cached index and live chain order identically) — never by a
  server `createdAt`, which is ingestion time, not block time.
- The API write surface is unauthenticated: validate `txHash` (e.g. `TxHashSchema`) before
  rendering a row as on-chain-"verified" or building a Basescan link — a forged row with a junk
  `txHash` must render "unconfirmed", never with a green verify link.
- Cap the rendered list (e.g. top 100 after sort) so a long-open tab doesn't grow the DOM
  unbounded, and show a per-source health indicator (render the other source if one errors; never
  silently drop events on a page whose whole pitch is verifiability).

## Prevention / checklist for the next browser chain-read feature

- [ ] Windowed `getContractEvents` (≤9k blocks, `strict: true`, literal `eventName`) with an incremental cursor — never one wide `fromBlock: DEPLOY → latest`.
- [ ] Resumable: advance the cursor + append per **successful** window; on a window error, `break` and return the partial cache (don't throw → no retry storm). Set the query's `retry` low.
- [ ] Persist `{cursor, cache}` to `localStorage`; hydrate once; guard SSR + corrupt data.
- [ ] In-flight promise latch around the module-singleton scan; don't rely on react-query dedup.
- [ ] `toBlock = head − N` (reorg buffer); document the resulting ~N-block feed latency.
- [ ] One shared 6-dec formatter through `BigInt(...)`; unit-test API-string vs chain-bigint parity.
- [ ] Standalone viem client (no wallet SDK) for public read pages; cap rendered rows; per-source health; validate `txHash` before "verified"/links.

## Cross-references

- [Privy + wagmi embedded wallet in Next.js 15 (§6: second injected config)](./privy-wagmi-nextjs15-app-router-build-and-prerender.md) — same feature; keeping the console's wallet SDK out of the wallet-free `/ledger` bundle.
- [Anthropic SDK structured output + Fastify fallback](./anthropic-sdk-structured-output-fastify-fallback.md) — the agent whose payout rows land in this ledger; same "re-validate at the trust boundary" discipline.
- [Prisma upsert can't ratchet — use raw ON CONFLICT](../database-issues/prisma-upsert-cannot-ratchet-use-raw-on-conflict.md) — why the API index has optimistic (block-less) rows that `ledgerSort` pins to the top.
