// Pure accrued-yield math, shared by the read hook and the ticker. Display formatting
// reuses formatTokenAmount (lib/amount.ts) — one 6-dec formatter, no second one.

/** Accrued yield = poolValue − totalSupply, clamped at 0 so a transient dip during a
 * halal rebalance (poolValue < totalSupply) never shows as negative / underflows. */
export function clampedYield(poolValue: bigint, totalSupply: bigint): bigint {
  return poolValue > totalSupply ? poolValue - totalSupply : 0n;
}
