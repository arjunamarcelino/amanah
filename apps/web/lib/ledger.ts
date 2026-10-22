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

// --- windowed, resumable chain scan ---------------------------------------------
// A single wide getLogs from START_BLOCK (~millions of blocks) exceeds the public RPC's
// ~10k range cap, so we scan fixed 9k-block windows behind an incremental cursor. The
// cursor + decoded cache persist to localStorage (amortized once per browser), and the
// scan is RESUMABLE: a failed window keeps prior progress and returns what we have
// (never throws → no react-query retry-storm re-scanning from START_BLOCK), and the next
// poll continues from the cursor.
const WINDOW = 9_000n;
const LS_KEY = `amanah.ledger.chain.${CHAIN_ID}`;

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
  const logs = await publicClient.getContractEvents({
    abi: CharityPoolAbi,
    address: A.CharityPool,
    eventName: "Invested",
    fromBlock: from,
    toBlock: to,
    strict: true,
  });
  return logs.map((l) =>
    lifecycleRow("Invested", l.args.assets, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

async function scanStandardYield(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const logs = await publicClient.getContractEvents({
    abi: MockYieldVaultAbi,
    address: A.MockYieldVault,
    eventName: "YieldAccrued",
    fromBlock: from,
    toBlock: to,
    strict: true,
  });
  return logs.map((l) =>
    lifecycleRow("YieldAccrued", l.args.amount, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

async function scanHalalYield(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const logs = await publicClient.getContractEvents({
    abi: MockHalalVaultAbi,
    address: A.MockHalalVault,
    eventName: "SukukYieldAccrued",
    fromBlock: from,
    toBlock: to,
    strict: true,
  });
  return logs.map((l) =>
    lifecycleRow("SukukYieldAccrued", l.args.amount, l.blockNumber!, l.logIndex!, l.transactionHash!),
  );
}

async function scanWindow(from: bigint, to: bigint): Promise<LedgerEntry[]> {
  const [invested, std, halal] = await Promise.all([
    scanInvested(from, to),
    scanStandardYield(from, to),
    scanHalalYield(from, to),
  ]);
  return [...invested, ...std, ...halal];
}

let cursor: bigint | null = null;
let cache: LedgerEntry[] = [];
let inflight: Promise<LedgerEntry[]> | null = null;
let hydrated = false;

function hydrateFromStorage(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { cursor?: string; cache?: LedgerEntry[] };
    if (parsed.cursor) cursor = BigInt(parsed.cursor);
    if (Array.isArray(parsed.cache)) cache = parsed.cache;
  } catch {
    // corrupt/unsupported cache — fall back to a cold scan
  }
}

function persist(): void {
  if (typeof window === "undefined" || cursor === null) return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ cursor: cursor.toString(), cache }));
  } catch {
    // quota/serialization — non-fatal
  }
}

/** Fetch the three un-indexed chain events, growing a persisted cache incrementally.
 * Concurrent callers share one in-flight scan (the invariant is enforced here, not
 * assumed from react-query's dedup). */
export async function fetchChainEvents(): Promise<LedgerEntry[]> {
  if (inflight) return inflight;
  hydrateFromStorage();
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
        // Resumable: keep progress, stop this round; the next poll resumes from `cursor`.
        console.error("[ledger] chain scan window failed; will resume next poll", err);
        break;
      }
      cache = cache.concat(rows);
      cursor = to;
      from = to + 1n;
    }
    persist();
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Reset the in-memory + persisted cache (tests / manual refresh). */
export function resetChainEventsCache(): void {
  cursor = null;
  cache = [];
  hydrated = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  }
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
