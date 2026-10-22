import type { Hex } from "viem";

// The single `string -> 0x${string}` narrowing boundary for untrusted hex. API
// responses and route params are plain `string`; viem wants `0x${string}`. Route
// such transitions through here — never cast with `as 0x${string}`.

/**
 * Narrow an untrusted string to a 32-byte hex (bytes32), or null. Lowercased to
 * match the canonical campaignId form (campaignIdFromSlug / normalizeHex).
 */
export function asBytes32(v: string): Hex | null {
  const s = v.trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(s) ? (s as Hex) : null;
}
