import { parseEventLogs } from "viem";
import type { Address, Hex, TransactionReceipt } from "viem";
import { CharityPoolAbi } from "./abis/index.js";

export type TrancheReleasedEvent = {
  payoutId: Hex;
  campaignId: Hex;
  beneficiary: Address;
  /** ACTUAL released amount in 6-dec base units — may be capped below the requested tranche. */
  usdcAmount: bigint;
  unlockTime: bigint;
  logIndex: number;
};

/**
 * Extract the `TrancheReleased` event from a mined receipt — the authoritative source of
 * the `payoutId` and the ACTUAL (possibly cap-limited) `usdcAmount` that PayoutRouter
 * stamped via setPending. recordAndPay reverts unless its args match that stamped record,
 * so the console must carry THESE values forward (never the preset tranche amount).
 *
 * Lives in shared so client and indexer decode it the same way (same family as
 * parseDonatedEvent). Returns null when the event is absent. Pre-filters to the pool
 * address (never trusts log index 0). When `expected.campaignId` is supplied, keeps only
 * the matching event — use it when a receipt could carry more than one release.
 */
export function parseTrancheReleasedEvent(
  receipt: TransactionReceipt,
  pool: Address,
  expected?: { campaignId: Hex },
): TrancheReleasedEvent | null {
  if (receipt.status !== "success") return null;

  const logs = parseEventLogs({
    abi: CharityPoolAbi,
    eventName: "TrancheReleased",
    logs: receipt.logs.filter((l) => l.address.toLowerCase() === pool.toLowerCase()),
  });

  const matching = expected
    ? logs.filter((l) => l.args.campaignId.toLowerCase() === expected.campaignId.toLowerCase())
    : logs;

  const ev = matching[0];
  if (!ev) return null;
  const a = ev.args;

  return {
    payoutId: a.payoutId,
    campaignId: a.campaignId,
    beneficiary: a.beneficiary,
    usdcAmount: a.usdcAmount,
    unlockTime: a.unlockTime,
    logIndex: ev.logIndex,
  };
}
