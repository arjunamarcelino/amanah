import { describe, it, expect } from "vitest";
import { buildDonationPayload, campaignIdFromSlug } from "../src/index.js";

const base = {
  txHash: ("0x" + "a".repeat(64)) as `0x${string}`,
  logIndex: 3,
  donor: ("0x" + "1".repeat(40)) as `0x${string}`,
  campaignId: campaignIdFromSlug("ph-typhoon-2025"),
  stablecoin: ("0x" + "2".repeat(40)) as `0x${string}`,
  amountIn: 1_000000n,
  baseOut: 999999n,
  consentHash: ("0x" + "c".repeat(64)) as `0x${string}`,
};

describe("buildDonationPayload", () => {
  it("stringifies bigint amounts and preserves fields", () => {
    const p = buildDonationPayload(base);
    expect(p.amountIn).toBe("1000000");
    expect(p.baseOut).toBe("999999");
    expect(p.logIndex).toBe(3);
    expect(p.campaignId).toBe(base.campaignId);
    expect(p.consentHash).toBe(base.consentHash);
  });

  it("rejects a malformed hash (schema .parse throws)", () => {
    expect(() => buildDonationPayload({ ...base, txHash: "0xnothex" as `0x${string}` })).toThrow();
  });

  it("round-trips a large (near-uint256) amount without precision loss", () => {
    const big = (1n << 200n) + 7n;
    expect(buildDonationPayload({ ...base, amountIn: big }).amountIn).toBe(big.toString());
  });
});
