import type { Log } from "viem";
import { publicClient } from "./client.js";
import { config } from "./config.js";
import { WATCHED_ADDRESSES, EVENT_ABIS } from "./contracts.js";
import { halve, isRangeOrResultCap, nextChunkEnd, regrow } from "./chunker.js";

// getLogs with `events` decodes matched logs, attaching eventName + args.
export type IndexerLog = Log<bigint, number, false> & {
  eventName?: string;
  args?: Record<string, unknown>;
};

/** Called once per processed chunk (even when `logs` is empty, so the cursor advances). */
export type ChunkHandler = (logs: IndexerLog[], toBlock: bigint) => Promise<void>;

const REGROW_AFTER_CLEAN = 3;

/**
 * Backfill [fromBlock, toBlock] in adaptive chunks. Filters getLogs by our
 * contract addresses + event topics (keeps result volume tiny and makes public-RPC
 * caps a non-issue), with strict:true so malformed logs are dropped. Halves the
 * step on a range/result cap and re-grows after a few clean chunks. A non-cap RPC
 * error propagates so the caller can back off; the cursor is never advanced on error.
 */
export async function backfill(
  fromBlock: bigint,
  toBlock: bigint,
  handle: ChunkHandler,
): Promise<void> {
  let from = fromBlock;
  let step = config.initialChunk;
  let cleanRuns = 0;

  while (from <= toBlock) {
    const end = nextChunkEnd(from, step, toBlock);
    let logs: IndexerLog[];
    try {
      logs = (await publicClient.getLogs({
        address: WATCHED_ADDRESSES,
        events: EVENT_ABIS,
        fromBlock: from,
        toBlock: end,
        strict: true,
      })) as IndexerLog[];
    } catch (err) {
      if (isRangeOrResultCap(err) && step > 1n) {
        step = halve(step);
        cleanRuns = 0;
        continue; // retry the SAME `from` with a smaller window
      }
      throw err;
    }

    await handle(logs, end);
    from = end + 1n;

    if (++cleanRuns >= REGROW_AFTER_CLEAN) {
      step = regrow(step, config.initialChunk);
      cleanRuns = 0;
    }
  }
}
