// Pure helpers for the adaptive block-range backfill. Kept side-effect-free so
// the (fiddly) range arithmetic is unit-tested without an RPC or DB.

/** Inclusive end of the next chunk starting at `from` with the given step, clamped to toBlock. */
export function nextChunkEnd(from: bigint, step: bigint, toBlock: bigint): bigint {
  const end = from + step - 1n;
  return end < toBlock ? end : toBlock;
}

/** Halve the step on an RPC range/result-cap error (floor of 1 block). */
export function halve(step: bigint): bigint {
  return step > 1n ? step / 2n : 1n;
}

/** Re-grow after N clean chunks so one cap error doesn't cripple throughput for good. */
export function regrow(step: bigint, max: bigint): bigint {
  const next = step * 2n;
  return next > max ? max : next;
}

/** Detect a provider block-range / result-count cap (a semantic error retrying won't fix). */
export function isRangeOrResultCap(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("range") || // also covers "block range"
    msg.includes("too many results") ||
    msg.includes("more than") || // also covers "query returned more than"
    msg.includes("10000") ||
    msg.includes("limit exceeded")
  );
}
