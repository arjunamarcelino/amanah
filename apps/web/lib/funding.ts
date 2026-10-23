// Display helpers for the card funding line. `baseRaised`/`goalBase` are base-unit
// integer strings (6-dp base, so 1_000_000 units = $1). All math is in BigInt so a
// 78-digit value never loses precision; only the final whole-dollar figure becomes a
// Number for locale formatting. Raised is REAL (summed confirmed on-chain donations);
// goal is a declared target. Progress % is derived, clamped to [0, 100].
const BASE_PER_USD = 1_000_000n;

export type FundingView = {
  raisedUsd: number;
  goalUsd: number | null;
  pct: number | null; // null when no goal
  raisedLabel: string; // e.g. "$42,959"
  goalLabel: string | null;
};

function safeBig(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

export function usd(whole: number): string {
  return `$${whole.toLocaleString("en-US")}`;
}

/** Build the funding view from the API's base-unit strings. */
export function fundingView(baseRaised: string, goalBase: string | null): FundingView {
  const raised = safeBig(baseRaised);
  const goal = goalBase ? safeBig(goalBase) : null;
  const raisedUsd = Number(raised / BASE_PER_USD);
  const goalUsd = goal !== null ? Number(goal / BASE_PER_USD) : null;
  // Derive pct from the SAME floored-dollar figures the labels show, so the bar and the
  // "$X raised of $Y" text never disagree (e.g. a ~100% bar labeled "$99 of $100"). Floored,
  // so it never over-reports raised.
  const pct =
    goalUsd !== null && goalUsd > 0
      ? Math.min(100, Math.max(0, (raisedUsd / goalUsd) * 100))
      : null;
  return {
    raisedUsd,
    goalUsd,
    pct,
    raisedLabel: usd(raisedUsd),
    goalLabel: goalUsd !== null ? usd(goalUsd) : null,
  };
}

/** Build a funding view straight from whole-dollar numbers (illustrative showcase cards). */
export function fundingViewFromUsd(raisedUsd: number, goalUsd: number): FundingView {
  const pct = goalUsd > 0 ? Math.min(100, Math.max(0, (raisedUsd / goalUsd) * 100)) : null;
  return { raisedUsd, goalUsd, pct, raisedLabel: usd(raisedUsd), goalLabel: usd(goalUsd) };
}
