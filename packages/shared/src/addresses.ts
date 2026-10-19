import { CHAIN_ID } from "./chain.js";
import type { Address } from "./types.js";

/**
 * Deployed contract addresses per chainId. Populated after contract deploys
 * in later prompts — on-chain contracts remain the source of truth for money.
 */
export const ADDRESSES: Record<number, Record<string, Address>> = {
  [CHAIN_ID]: {
    // pool: "0x...",
  },
};
