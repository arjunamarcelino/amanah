---
title: "Prisma upsert can't express a monotonic/ratchet write — use raw ON CONFLICT ... DO UPDATE ... WHERE"
date: 2026-10-21
category: database-issues
problem_type: logic_error
component: db
severity: blocking
status: resolved
symptoms:
  - "A 'confirmed' row gets silently downgraded back to 'pending' by a late optimistic write"
  - "Need write-once / monotonic columns but Prisma upsert overwrites them every time"
  - "Two writers (API optimistic + indexer confirm) to one table and no way to guard the update"
  - "Idempotent replay is not actually idempotent — re-running rewrites timestamps/overwrites facts"
tags: [prisma, postgres, upsert, on-conflict, idempotency, ratchet, two-writer, optimistic-write, event-indexer]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/6
  - commit: a3531d6  # feat(db): monotonic write repository for money tables
  - commit: aa04960  # fix(db): fuse optimistic donation into the confirmed row by txHash
  - review: docs/reviews/2026-10-21-pr6-offchain-backend-review.md  # findings P1-1, verified-safe
  - solution: docs/solutions/build-errors/foundry-deploy-labeled-ledger-vm-writejson.md
---

# Prisma `upsert` can't express a monotonic/ratchet write — use raw `ON CONFLICT ... DO UPDATE ... WHERE`

## Problem

We had two independent writers to the same rows:

- the **API** writes an *optimistic* `pending` row right after a user sends a tx, and
- a **viem indexer** later writes the *authoritative* `confirmed` row from the on-chain event.

The invariant: **`confirmed` is a one-way ratchet** (a late optimistic POST must never downgrade a
confirmed row), and the on-chain payout facts (`releasedTxHash`, `routedTxHash`, amounts) must be
**write-once** so out-of-order / replayed events can't corrupt them.

The obvious implementation — `prisma.x.upsert({ where, create, update })` — **cannot express this**.
Prisma's `upsert` runs its `update` branch **unconditionally** on conflict: there is no
`WHERE` clause on the update, and no way to reference the *existing* row to decide whether to write.
So:

```ts
// ❌ a late optimistic POST downgrades the already-confirmed row
await prisma.donationLog.upsert({
  where: { txHash_logIndex: { txHash, logIndex } },
  update: { status: "pending", ... },   // runs even if the row is already "confirmed"
  create: { status: "pending", ... },
});
```

This passed build/lint/tests and *looked* correct — it was only caught in multi-agent code review
(finding P1-1), because the bug needs a specific interleaving to observe.

## Root cause

- Prisma `upsert` has no conditional-update support and no `ON CONFLICT ... WHERE` / `COALESCE`
  expression surface. Its `update` is a full, unconditional write.
- Modeling a **ratchet** (state only moves forward) or **write-once** columns therefore cannot go
  through `upsert`, `update`, or `updateMany`-after-read (the read-then-write also races under
  `READ COMMITTED`).

## Solution

Move every write to the contended table behind a small **repository** that uses **raw
`INSERT ... ON CONFLICT (key) DO UPDATE ... WHERE ...`** via Prisma `$executeRaw`. This is a single
atomic statement — Postgres row-locks the conflicting tuple until commit, so `READ COMMITTED` is
sufficient (no read-then-write window).

```ts
// ✅ ratchet: never downgrade a confirmed row; COALESCE makes replay a true no-op
export function confirmDonation(db: Executor, i: ConfirmDonationInput) {
  return db.$executeRaw`
    INSERT INTO "DonationLog" (..., "status", "confirmedAt")
    VALUES (..., 'confirmed', now())
    ON CONFLICT ("txHash","logIndex") DO UPDATE SET
      "status" = 'confirmed',
      "confirmedAt" = COALESCE("DonationLog"."confirmedAt", now())  -- write-once
    WHERE "DonationLog"."status" <> 'confirmed'                      -- ratchet guard
  `;
}
```

Key techniques:

- **`WHERE` on the `DO UPDATE`** is the ratchet (`status <> 'confirmed'`, or `cancelledAt IS NULL`
  for a terminal state). A no-match is a clean no-op, not an error.
- **`COALESCE(existing, EXCLUDED)`** makes a column **write-once** — the first value wins, replays
  and out-of-order events don't clobber it.
- **Derive status in the SQL `CASE`** from the write-once fact columns; do **not** keep a parallel
  TS "mirror" function as the source of truth — it only ever gets unit-tested against itself and
  silently drifts from the SQL (we deleted ours in review finding P2-7).
- Make the repository the **single writer** of those tables (the API and the indexer both call it,
  including the expiry sweeps) so the invariant lives in exactly one audited place.

### Enum casts & identifiers in raw SQL (Prisma/Postgres)
- Table/column identifiers are **static string literals** in the template — never interpolate them
  (keeps it injection-safe; all `${...}` are bound *values*).
- Prisma maps a model enum to a Postgres type named exactly like the enum, so cast with
  `'routed'::"PayoutStatus"` inside `CASE`/`SET` expressions. A bare `'routed'` literal in an
  `INSERT ... VALUES` coerces from the target column type and needs no cast.
- There is no DB default for Prisma's `@default(cuid())` (it's app-side), so generate the `id` in
  JS (`randomUUID()`) and bind it.

## Related gotcha — don't key optimistic↔confirmed fusion on a value only one writer knows

A sibling bug (P1-1): the fusion key was `(txHash, logIndex)`, but the optimistic POST doesn't know
the real log index (it posts `0`), while a real event's log index is almost never `0` (token
`Transfer`/swap logs precede it). So `ON CONFLICT (txHash, logIndex)` **never matched**, the
confirmed row inserted separately, and the pending row was orphaned → double-count. Fix: fuse on a
key **both writers agree on** — here, `UPDATE` the pending row *by `txHash`* (correcting its real
`logIndex`) and only `INSERT` when none exists.

## Prevention

- **Red flag:** any time you write "ratchet", "write-once", "monotonic", "idempotent replay", or
  "two writers to one row" — Prisma `upsert`/`update` will not enforce it. Reach for raw
  `ON CONFLICT ... DO UPDATE ... WHERE` + `COALESCE`.
- Centralize contended-table writes in one repository module; let the type system make it the only
  path (don't scatter `prisma.x.upsert` for those tables across services + the indexer + a sweep).
- Key optimistic↔authoritative fusion on an identity both sides can compute, not on a field one
  side has to guess.
- These bugs pass tests and typecheck — they surface only under specific interleavings. Review
  write paths to two-writer tables explicitly, or add an integration test that interleaves
  optimistic-then-confirm and confirm-then-late-optimistic against a real Postgres.
