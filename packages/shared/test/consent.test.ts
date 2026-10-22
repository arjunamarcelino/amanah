import { describe, it, expect } from "vitest";
import {
  buildConsentHash,
  STATEMENT_HASH,
  STATEMENT_TEXT,
  CONSENT_VERSION,
  campaignIdFromSlug,
} from "../src/index.js";

const campaignId = campaignIdFromSlug("ph-typhoon-2025");
const donor = ("0x" + "1".repeat(40)) as `0x${string}`;
const stablecoin = ("0x" + "2".repeat(40)) as `0x${string}`;
const amount = 1_000000n; // 1.000000 (6 decimals)

describe("buildConsentHash", () => {
  it("returns a 32-byte hex", () => {
    expect(buildConsentHash({ campaignId, donor, stablecoin, amount })).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(buildConsentHash({ campaignId, donor, stablecoin, amount })).toBe(
      buildConsentHash({ campaignId, donor, stablecoin, amount }),
    );
  });

  it("changes when ANY preimage field changes", () => {
    const base = buildConsentHash({ campaignId, donor, stablecoin, amount });
    expect(buildConsentHash({ campaignId, donor, stablecoin, amount: amount + 1n })).not.toBe(base);
    expect(
      buildConsentHash({ campaignId, donor: ("0x" + "3".repeat(40)) as `0x${string}`, stablecoin, amount }),
    ).not.toBe(base);
    expect(
      buildConsentHash({ campaignId, donor, stablecoin: ("0x" + "4".repeat(40)) as `0x${string}`, amount }),
    ).not.toBe(base);
    expect(
      buildConsentHash({ campaignId: campaignIdFromSlug("other-campaign"), donor, stablecoin, amount }),
    ).not.toBe(base);
  });

  it("pins the versioned statement", () => {
    expect(CONSENT_VERSION).toBe(1);
    expect(STATEMENT_TEXT).toContain("amanah");
    expect(STATEMENT_HASH).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
