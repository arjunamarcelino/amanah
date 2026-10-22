import { parseUnits, formatUnits } from "viem";
import { UINT256_MAX } from "@amanah/shared";

// Stablecoins (mUSDC/mXSGD/mIDRX) are 6-decimal. Conversion is delegated to viem's
// parseUnits/formatUnits; this module only adds input validation on top (parseUnits
// alone won't reject >6dp, scientific notation, commas, etc.).
const DECIMALS = 6;

export type AmountError =
  | "empty"
  | "not_numeric"
  | "too_many_decimals"
  | "not_positive"
  | "too_large";

export type ParseAmountResult = { ok: true; value: bigint } | { ok: false; error: AmountError };

/** Human-readable message per validation error code. */
export const AMOUNT_ERROR_MESSAGE: Record<AmountError, string> = {
  empty: "Enter an amount",
  not_numeric: "Enter a valid number",
  too_many_decimals: "At most 6 decimal places",
  not_positive: "Amount must be greater than 0",
  too_large: "Amount is too large",
};

/** Parse a user-typed amount into base units. No throwing — returns a union. */
export function parseTokenAmount(input: string, decimals: number = DECIMALS): ParseAmountResult {
  const s = input.trim();
  if (s === "") return { ok: false, error: "empty" };
  // plain decimal only: no sign, no exponent, no commas, no whitespace inside
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: "not_numeric" };
  const frac = s.split(".")[1] ?? "";
  if (frac.length > decimals) return { ok: false, error: "too_many_decimals" };
  let value: bigint;
  try {
    value = parseUnits(s, decimals);
  } catch {
    return { ok: false, error: "not_numeric" };
  }
  if (value <= 0n) return { ok: false, error: "not_positive" };
  if (value > UINT256_MAX) return { ok: false, error: "too_large" };
  return { ok: true, value };
}

/** Format base units for display. */
export function formatTokenAmount(value: bigint, decimals: number = DECIMALS): string {
  return formatUnits(value, decimals);
}
