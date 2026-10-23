import { z } from "zod";

/**
 * Canonical hex form: trimmed, lowercased, `0x`-prefixed.
 *
 * EVERY writer (seed, API, indexer) MUST run hex values through this before a
 * DB write/compare. Postgres text comparison is case-sensitive and viem returns
 * mixed-case (checksummed) addresses, so without normalization the
 * `@@unique([txHash,logIndex])` / `payoutId` / `campaignId` keys silently fail
 * to dedupe and the pending→confirmed ratchet breaks.
 */
export function normalizeHex(input: string): `0x${string}` {
  const s = input.trim().toLowerCase();
  return (s.startsWith("0x") ? s : `0x${s}`) as `0x${string}`;
}

/** Max uint256 = 2^256 − 1 (a 78-digit number). */
export const UINT256_MAX = (1n << 256n) - 1n;

// Case-insensitive on input (callers normalize at the write boundary). Kept as
// refinements — NO `.transform` — so request DTOs satisfy z.input === z.output.
export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "invalid EVM address");

export const Bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "invalid bytes32 hex");

/** A 32-byte transaction hash. */
export const TxHashSchema = Bytes32Schema;

/**
 * A non-negative integer amount, as a STRING, within uint256 range.
 * String end-to-end (never a JS number) so 78-digit values keep full precision.
 * The regex alone admits values in (2^256, 10^78) so the BigInt bound is required.
 */
export const DecimalStringSchema = z
  .string()
  .regex(/^\d{1,78}$/, "must be a non-negative integer string")
  .refine((v) => {
    try {
      return BigInt(v) <= UINT256_MAX;
    } catch {
      return false;
    }
  }, "exceeds uint256 max");

/**
 * A non-negative integer amount that is a SUM of uint256 values (e.g. a campaign's total
 * raised = Σ donation baseOut). A sum is not individually uint256-bounded, so this drops the
 * uint256 refinement and only bounds the digit count (DoS/garbage guard). Using the stricter
 * DecimalStringSchema here would risk rejecting the whole response row over a display total.
 */
export const DecimalSumStringSchema = z
  .string()
  .regex(/^\d{1,90}$/, "must be a non-negative integer string");
