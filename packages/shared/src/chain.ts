/** Chain constants — Base Sepolia (testnet only). */
// CANONICAL chain id. Mirrored (as a plain literal, since neither can import this at the
// relevant time) in packages/contracts: Deploy.s.sol's chainid guard and export-shared.mjs.
// Keep those two in sync with this value.
export const CHAIN_ID = 84532 as const;
export const CHAIN_NAME = "Base Sepolia" as const;

/** Public RPC placeholder; override via BASE_SEPOLIA_RPC_URL in later prompts. */
export const DEFAULT_RPC_URL = "https://sepolia.base.org" as const;

/** Block explorer for the ledger UI. */
export const EXPLORER_URL = "https://sepolia.basescan.org" as const;
