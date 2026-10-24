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
export type DemoSlug = "ph-typhoon-2025" | "id-forest-fire-2026";

export type ReleasePreset = {
  beneficiary: Address;
  /** Requested tranche in 6-dec base units. */
  trancheAmount: bigint;
  /** Short condition note recorded on-chain by fire()/approveMilestone(). */
  detail: string;
};

// ⚠️ TESTNET DEMO ONLY. The `beneficiary` addresses below are deliberate burn/placeholder
// addresses (0x…dEaD, 0x…f13e) — they can NEVER receive or move funds. This is safe only
// because the demo runs on Base Sepolia with mock stablecoins (mUSDC/mXSGD/mIDRX) that have
// no real value. Before any mainnet deployment these MUST be replaced with real, custodied
// recipient addresses, or released tranches will be permanently unrecoverable.
export const RELEASE_PRESETS: Record<DemoSlug, ReleasePreset> = {
  "ph-typhoon-2025": {
    beneficiary: "0x000000000000000000000000000000000000dEaD",
    trancheAmount: 500_000_000n, // 500 USDC
    detail: "Typhoon Cat 4, Tacloban",
  },
  "id-forest-fire-2026": {
    beneficiary: "0x000000000000000000000000000000000000f13e",
    trancheAmount: 500_000_000n, // 500 USDC
    detail: "Forest-fire haze emergency, Sumatra",
  },
};

export function presetForSlug(slug: string): ReleasePreset | null {
  return (RELEASE_PRESETS as Record<string, ReleasePreset>)[slug] ?? null;
}
