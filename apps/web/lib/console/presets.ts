import type { Address } from "viem";

// Demo release presets, keyed by campaign slug. These feed the INPUTS to
// releaseTranche (beneficiary + requested tranche amount) and the fire/approve
// `detail` string. The ACTUAL released amount comes back from the TrancheReleased
// event (may be cap-limited) and is what recordAndPay must use — never these values.
//
// `country` is intentionally NOT here: it must match the candidate rails, so the
// route step derives it from the selected campaign, not a hand-seeded preset.
//
// Keep these aligned with scripts/seed-demo (PROMPT 12): same slugs, same
// beneficiary addresses, same amounts.

/** Slugs the console knows how to drive. A typed union (not Record<string,…>) so a
 * miss is visible and `apps/web` doesn't need noUncheckedIndexedAccess to stay sound. */
export type DemoSlug = "ph-typhoon-2025" | "edu-waqf-2025";

export type ReleasePreset = {
  beneficiary: Address;
  /** Requested tranche in 6-dec base units. */
  trancheAmount: bigint;
  /** Short condition note recorded on-chain by fire()/approveMilestone(). */
  detail: string;
};

export const RELEASE_PRESETS: Record<DemoSlug, ReleasePreset> = {
  "ph-typhoon-2025": {
    beneficiary: "0x000000000000000000000000000000000000dEaD",
    trancheAmount: 500_000_000n, // 500 USDC
    detail: "Typhoon Cat 4, Tacloban",
  },
  "edu-waqf-2025": {
    beneficiary: "0x000000000000000000000000000000000000bEEF",
    trancheAmount: 300_000_000n, // 300 USDC
    detail: "School supplies delivered",
  },
};

export function presetForSlug(slug: string): ReleasePreset | null {
  return (RELEASE_PRESETS as Record<string, ReleasePreset>)[slug] ?? null;
}
