import { getAddress, type Address, type Hex } from "viem";

// The single `string -> 0x${string}` narrowing boundary. API responses and route
// params are plain `string`; viem wants `0x${string}`. Route EVERY such transition
// through these helpers — never cast with `as 0x${string}`.

/**
 * Narrow an untrusted string to a 32-byte hex (bytes32), or null. Lowercased to
 * match the canonical campaignId form (campaignIdFromSlug / normalizeHex).
 */
export function asBytes32(v: string): Hex | null {
  const s = v.trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(s) ? (s as Hex) : null;
}

/**
 * Narrow an untrusted string to a checksummed EVM address, or null. Accepts any
 * case on input; `getAddress` rejects a wrong mixed-case checksum.
 */
export function asAddress(v: string): Address | null {
  const s = v.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  try {
    return getAddress(s);
  } catch {
    return null;
  }
}
