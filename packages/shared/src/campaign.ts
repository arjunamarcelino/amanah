import { keccak256, toBytes } from "viem";

/**
 * Deterministic campaignId = keccak256(utf8(slug)).
 *
 * The SAME preimage must be used on-chain (`ReleaseController.registerCampaign`)
 * and offchain (seed + metadata), so indexed `CampaignRegistered` / `Donated`
 * events join to the offchain metadata row by this exact bytes32. Matches the
 * contracts' test convention `keccak256("<slug>")`. viem's `keccak256` returns
 * a lowercased `0x`-hex, already in canonical form.
 */
export function campaignIdFromSlug(slug: string): `0x${string}` {
  return keccak256(toBytes(slug));
}
