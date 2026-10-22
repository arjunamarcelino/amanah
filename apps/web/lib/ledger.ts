import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import {
  CharityPoolAbi,
  MockYieldVaultAbi,
  MockHalalVaultAbi,
  ADDRESSES,
  CHAIN_ID,
  START_BLOCK,
  ledgerSort,
  type LedgerEntry,
} from "@amanah/shared";
import { formatTokenAmount } from "./amount";
import { ENV } from "./env";

// Glass-box ledger: the cached API index (GET /ledger) covers Donated/payout/lifecycle
// rows, but NOT Invested/YieldAccrued/SukukYieldAccrued (the indexer doesn't project them).
// This module reads those three straight from chain and merges them with the API feed —
// chain is the source of truth, the API is the convenience index.
//
// NO wagmi/Privy here: a standalone viem client so /ledger stays wallet-free.

const A = ADDRESSES[CHAIN_ID];
const REORG_BUFFER = 15n; // OP-stack reorg bound (mirrors the indexer)

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(ENV.rpcUrl, { batch: true }),
  batch: { multicall: true },
});

// --- chunked scan ---------------------------------------------------------------
// A single wide getLogs from START_BLOCK (~millions of blocks) exceeds the public RPC's
// ~10k range cap and fails. Scan in bounded windows, halving on a range/result-cap error.
function isRangeOrResultCap(err: unknown): boolean {
  const m = String((err as Error | undefined)?.message ?? "").toLowerCase();
  return (
    m.includes("range") ||
    m.includes("limit") ||
    m.includes("more than") ||
    m.includes("too large") ||
    m.includes("10000")
  );
}

async function scanRange<T>(
  fetchWindow: (from: bigint, to: bigint) => Promise<T[]>,
  from: bigint,
  to: bigint,
  initialStep = 9_000n,
): Promise<T[]> {
  const out: T[] = [];
  let cursor = from;
  let step = initialStep;
  while (cursor <= to) {
    const end = cursor + step - 1n < to ? cursor + step - 1n : to;
    try {
      out.push(...(await fetchWindow(cursor, end)));
      cursor = end + 1n;
    } catch (err) {
      if (isRangeOrResultCap(err) && step > 1n) {
        step = step / 2n;
        continue;
      }
      throw err;
    }
  }
  return out;
}

function lifecycleRow(
  eventName: string,
  amount: bigint,
  blockNumber: bigint,
  logIndex: number,
  txHash: `0x${string}`,
): LedgerEntry {
  return {
    kind: "lifecycle",
    eventName,
    blockNumber: blockNumber.toString(),
    logIndex,
    txHash,
    campaignId: null, // these events carry no campaign dimension
    campaignName: null,
    status: "confirmed",
    payload: { amount: amount.toString() }, // base-units string (parity with API rows)
    createdAt: "", // no block timestamp fetched; ledgerSort orders these by block/logIndex
  };
}

async function scanInvested(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const logs = await scanRange(
    (f, t) =>
      publicClient.getContractEvents({
        abi: CharityPoolAbi,
        address: A.CharityPool,
        eventName: "Invested",
        fromBlock: f,
        toBlock: t,
        strict: true,
      }),
    from,
    to,
  );
  return logs.map((l) =>
    lifecycleRow("Invested", l.args.assets, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

async function scanStandardYield(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const logs = await scanRange(
    (f, t) =>
      publicClient.getContractEvents({
        abi: MockYieldVaultAbi,
        address: A.MockYieldVault,
        eventName: "YieldAccrued",
        fromBlock: f,
        toBlock: t,
        strict: true,
      }),
    from,
    to,
  );
  return logs.map((l) =>
    lifecycleRow("YieldAccrued", l.args.amount, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

async function scanHalalYield(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const logs = await scanRange(
    (f, t) =>
      publicClient.getContractEvents({
        abi: MockHalalVaultAbi,
        address: A.MockHalalVault,
        eventName: "SukukYieldAccrued",
        fromBlock: f,
        toBlock: t,
        strict: true,
      }),
    from,
    to,
  );
  return logs.map((l) =>
    lifecycleRow("SukukYieldAccrued", l.args.amount, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

// Incremental cursor: cold-scan once from START_BLOCK, then only new blocks per poll.
let cursor: bigint | null = null;
let cache: LedgerEntry[] = [];

/** Fetch the three un-indexed chain events, growing an in-memory cache incrementally. */
export async function fetchChainEvents(): Promise<LedgerEntry[]> {
  const head = await publicClient.getBlockNumber();
  const safeHead = head > REORG_BUFFER ? head - REORG_BUFFER : head;
  const from = cursor === null ? BigInt(START_BLOCK) : cursor + 1n;
  if (from <= safeHead) {
    const [invested, std, halal] = await Promise.all([
      scanInvested(from, safeHead),
      scanStandardYield(from, safeHead),
      scanHalalYield(from, safeHead),
    ]);
    cache = [...cache, ...invested, ...std, ...halal];
    cursor = safeHead;
  }
  return cache;
}

/** Reset the module cache (tests / manual refresh). */
export function resetChainEventsCache(): void {
  cursor = null;
  cache = [];
}

// --- pure merge + display helpers (unit-tested) ---------------------------------

/** Merge the API index with chain rows: dedup confirmed rows by (txHash, logIndex),
 * then order with the SAME shared comparator the API uses. Optimistic (null-block,
 * null-txHash) rows are kept and pinned to the top by ledgerSort. */
export function mergeLedger(api: LedgerEntry[], chain: LedgerEntry[]): LedgerEntry[] {
  const seen = new Set<string>();
  const out: LedgerEntry[] = [];
  for (const e of [...api, ...chain]) {
    if (e.txHash && e.logIndex !== null) {
      const key = `${e.txHash.toLowerCase()}:${e.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(e);
  }
  return out.sort(ledgerSort);
}

function amountBaseUnits(entry: LedgerEntry): string | null {
  const p = entry.payload;
  const raw =
    entry.kind === "donation"
      ? p.amountIn
      : entry.kind === "payout"
        ? p.usdcAmount
        : p.amount; // lifecycle: Invested / (Sukuk)YieldAccrued
  if (raw == null) return null;
  const s = String(raw);
  return /^\d+$/.test(s) ? s : null; // base-units integer string only
}

/** Format a row's amount identically regardless of source (API decimal-string base units
 * vs chain bigint base units both round-trip through BigInt → formatTokenAmount). */
export function ledgerDisplayAmount(entry: LedgerEntry): string | null {
  const base = amountBaseUnits(entry);
  return base === null ? null : formatTokenAmount(BigInt(base));
}

/** Stable React key: (txHash, logIndex) when present, else a kind/event/createdAt fallback. */
export function ledgerKey(entry: LedgerEntry): string {
  if (entry.txHash && entry.logIndex !== null) return `${entry.txHash}:${entry.logIndex}`;
  return `${entry.kind}:${entry.eventName}:${entry.campaignId ?? "-"}:${entry.createdAt}`;
}
