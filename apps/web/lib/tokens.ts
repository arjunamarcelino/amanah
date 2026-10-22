import { ADDRESSES, CHAIN_ID } from "@amanah/shared";
import type { Address } from "viem";

export type StablecoinKey = "mUSDC" | "mXSGD" | "mIDRX";

// The three 6-decimal mock stablecoins donors can mint + donate.
export const STABLECOINS: { key: StablecoinKey; address: Address; label: string }[] = [
  { key: "mUSDC", address: ADDRESSES[CHAIN_ID].mUSDC, label: "mUSDC" },
  { key: "mXSGD", address: ADDRESSES[CHAIN_ID].mXSGD, label: "mXSGD" },
  { key: "mIDRX", address: ADDRESSES[CHAIN_ID].mIDRX, label: "mIDRX" },
];

// Total by construction — StablecoinKey is a closed union, so no throw path.
const TOKEN_ADDRESS: Record<StablecoinKey, Address> = {
  mUSDC: ADDRESSES[CHAIN_ID].mUSDC,
  mXSGD: ADDRESSES[CHAIN_ID].mXSGD,
  mIDRX: ADDRESSES[CHAIN_ID].mIDRX,
};

export function tokenByKey(key: StablecoinKey): Address {
  return TOKEN_ADDRESS[key];
}
