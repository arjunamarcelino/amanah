import type { AbiEvent } from "viem";
import {
  ADDRESSES,
  CHAIN_ID,
  CharityPoolAbi,
  PayoutRouterAbi,
  ReleaseControllerAbi,
  normalizeHex,
} from "@amanah/shared";

const a = ADDRESSES[CHAIN_ID];

// The three event-emitting contracts the indexer mirrors (lowercased for the
// getLogs address filter and for rejecting out-of-set logs).
export const WATCHED_ADDRESSES: `0x${string}`[] = [
  normalizeHex(a.CharityPool) as `0x${string}`,
  normalizeHex(a.PayoutRouter) as `0x${string}`,
  normalizeHex(a.ReleaseController) as `0x${string}`,
];

const WATCHED_SET = new Set(WATCHED_ADDRESSES);

/** True if a decoded log came from one of our contracts (RPC-integrity guard). */
export function isWatchedAddress(address: string): boolean {
  return WATCHED_SET.has(normalizeHex(address) as `0x${string}`);
}

function pickEvents(abi: readonly unknown[]): AbiEvent[] {
  return abi.filter((item): item is AbiEvent => (item as { type?: string }).type === "event");
}

// Every event across the three contracts. Typed handlers (C17) project the ones
// that matter; the rest still land in EventIndex as the raw audit trail.
export const EVENT_ABIS: AbiEvent[] = [
  ...pickEvents(CharityPoolAbi),
  ...pickEvents(PayoutRouterAbi),
  ...pickEvents(ReleaseControllerAbi),
];
