import { keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from "viem";
import type { Address, Hex } from "viem";

// Consent commitment for a donation. The on-chain `CharityPool.donate` stores
// `consentHash` but only rejects the zero hash (it is UNVERIFIED on-chain), and
// the API never re-checks it — so this builder is the SOLE enforcer of consent
// integrity. It therefore must be derived from the exact arguments passed to
// `donate` (campaignId, stablecoin, amount) plus the donor, never from mutable
// UI state. Protocol canon: the api/indexer can recompute the same hash.

/**
 * Consent schema version, baked into the preimage so the statement can evolve
 * without silent hash drift. `uint16` → a JS `number` (viem maps ints ≤48 bits
 * to number); authoring it as a bigint will (correctly) fail to type-check.
 */
export const CONSENT_VERSION = 1;

/**
 * Canonical consent statement (v1). Hashed as keccak256(utf8(text)), so this
 * string is part of the hash preimage — changing it REQUIRES a CONSENT_VERSION bump.
 */
export const STATEMENT_TEXT =
  "I give this charity willingly and irrevocably through Amanah, as an amanah (trust) " +
  "for those in need. I understand it is recorded permanently on-chain on Base Sepolia " +
  "and cannot be reversed.";

/** keccak256 of the canonical statement text. */
export const STATEMENT_HASH: Hex = keccak256(toBytes(STATEMENT_TEXT));

// Typed, fixed-order ABI params (collision-safe — abi.encode, NOT encodePacked).
const CONSENT_ABI = parseAbiParameters(
  "uint16 version, bytes32 campaignId, address donor, address stablecoin, uint256 amount, bytes32 statementHash",
);

/**
 * Deterministic consent hash bound to the exact gift. Same inputs → same hash,
 * reproducibly, across client / api / indexer.
 */
export function buildConsentHash(input: {
  campaignId: Hex;
  donor: Address;
  stablecoin: Address;
  amount: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(CONSENT_ABI, [
      CONSENT_VERSION,
      input.campaignId,
      input.donor,
      input.stablecoin,
      input.amount,
      STATEMENT_HASH,
    ]),
  );
}
