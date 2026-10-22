import { ADDRESSES, CHAIN_ID } from "@amanah/shared";
import type { Address } from "viem";

export type StablecoinKey = "mUSDC" | "mXSGD" | "mIDRX";

// The three 6-decimal mock stablecoins donors can mint + donate.
export const STABLECOINS: { key: StablecoinKey; address: Address; label: string }[] = [
  { key: "mUSDC", address: ADDRESSES[CHAIN_ID].mUSDC, label: "mUSDC" },
  { key: "mXSGD", address: ADDRESSES[CHAIN_ID].mXSGD, label: "mXSGD" },
  { key: "mIDRX", address: ADDRESSES[CHAIN_ID].mIDRX, label: "mIDRX" },
];

export function tokenByKey(key: StablecoinKey): Address {
  const found = STABLECOINS.find((s) => s.key === key);
  if (!found) throw new Error(`unknown stablecoin ${key}`);
  return found.address;
}
