/** Chain constants — Base Sepolia (testnet only). */
// CANONICAL chain id. Mirrored (as a plain literal, since neither can import this at the
// relevant time) in packages/contracts: Deploy.s.sol's chainid guard and export-shared.mjs.
// Keep those two in sync with this value.
export const CHAIN_ID = 84532 as const;
export const CHAIN_NAME = "Base Sepolia" as const;

/** Public RPC default; override via BASE_SEPOLIA_RPC_URL. */
export const DEFAULT_RPC_URL = "https://sepolia.base.org" as const;

/** Base Sepolia block explorer (BaseScan). */
export const EXPLORER_URL = "https://sepolia.basescan.org" as const;

/** BaseScan URL for a transaction hash (success-screen deep link). */
export function txUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}
