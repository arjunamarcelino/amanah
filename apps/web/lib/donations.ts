import { parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";
import { CharityPoolAbi } from "@amanah/shared";

export type DonatedEvent = { baseOut: bigint; logIndex: number };

/**
 * Extract the `Donated` event from a mined receipt — the authoritative source of
 * `baseOut` and the real `logIndex` (a tx return value isn't in a receipt).
 *
 * Returns null when the event is absent (caller shows success-without-POST).
 * Pre-filters to the CharityPool address (never trusts log index 0). When
 * `expected` is supplied, asserts the decoded fields equal the submitted args —
 * defends against a lying/MITM RPC and catches any arg desync (S-3).
 */
export function parseDonatedEvent(
  receipt: TransactionReceipt,
  pool: Address,
  expected?: { campaignId: Hex; stablecoin: Address; donor: Address; amount: bigint },
): DonatedEvent | null {
  if (receipt.status !== "success") return null;

  const logs = parseEventLogs({
    abi: CharityPoolAbi,
    eventName: "Donated",
    logs: receipt.logs.filter((l) => l.address.toLowerCase() === pool.toLowerCase()),
  });

  const ev = logs[0];
  if (!ev) return null;
  const a = ev.args;

  if (expected) {
    const matches =
      a.campaignId.toLowerCase() === expected.campaignId.toLowerCase() &&
      a.stablecoin.toLowerCase() === expected.stablecoin.toLowerCase() &&
      a.donor.toLowerCase() === expected.donor.toLowerCase() &&
      a.amountIn === expected.amount;
    if (!matches) return null;
  }

  return { baseOut: a.baseOut, logIndex: ev.logIndex };
}
