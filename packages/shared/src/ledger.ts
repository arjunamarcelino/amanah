import type { LedgerEntry } from "./schemas.js";

/**
 * Chain order, newest first: by (blockNumber, logIndex) desc for rows that have a
 * block. Block-less rows — optimistic pending donations and payouts (which
 * aggregate multiple txs) — pin to the top ordered by createdAt desc. Must NOT
 * sort confirmed rows by createdAt: that is the indexer transaction's now(),
 * constant across an entire chunk, which collapses a chunk's blocks to one key.
 *
 * Lives in shared so the API's cached index and the web's live chain-merge order
 * identically (the web ledger fills the un-indexed Invested/YieldAccrued gap).
 */
export function ledgerSort(a: LedgerEntry, b: LedgerEntry): number {
  const aBlockless = a.blockNumber === null;
  const bBlockless = b.blockNumber === null;
  if (aBlockless !== bBlockless) return aBlockless ? -1 : 1; // block-less pinned to top

  if (!aBlockless && !bBlockless && a.blockNumber !== b.blockNumber) {
    return BigInt(a.blockNumber!) < BigInt(b.blockNumber!) ? 1 : -1; // block desc
  }
  const al = a.logIndex ?? -1;
  const bl = b.logIndex ?? -1;
  if (al !== bl) return bl - al; // logIndex desc
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1; // createdAt desc
  return 0;
}
