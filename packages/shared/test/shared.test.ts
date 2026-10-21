import { describe, it, expect } from "vitest";
import {
  normalizeHex,
  AddressSchema,
  Bytes32Schema,
  DecimalStringSchema,
  UINT256_MAX,
  campaignIdFromSlug,
  releaseTypeFromOrdinal,
  RELEASE_TYPE_LABEL,
  CreateCampaignSchema,
} from "../src/index.js";

describe("normalizeHex", () => {
  it("lowercases and 0x-prefixes", () => {
    expect(normalizeHex("0xAbCdEf")).toBe("0xabcdef");
    expect(normalizeHex("ABCDEF")).toBe("0xabcdef");
    expect(normalizeHex("  0xAB  ")).toBe("0xab");
  });
});

describe("AddressSchema / Bytes32Schema", () => {
  const addr = "0x" + "a".repeat(40);
  const b32 = "0x" + "b".repeat(64);
  it("accepts valid (any case)", () => {
    expect(AddressSchema.safeParse(addr).success).toBe(true);
    expect(AddressSchema.safeParse("0x" + "A".repeat(40)).success).toBe(true);
    expect(Bytes32Schema.safeParse(b32).success).toBe(true);
  });
  it("rejects wrong length / non-hex / missing prefix", () => {
    expect(AddressSchema.safeParse("0x" + "a".repeat(39)).success).toBe(false);
    expect(Bytes32Schema.safeParse("0xzz").success).toBe(false);
    expect(AddressSchema.safeParse("a".repeat(40)).success).toBe(false);
  });
});

describe("DecimalStringSchema", () => {
  it("accepts 0 and the uint256 max", () => {
    expect(DecimalStringSchema.safeParse("0").success).toBe(true);
    expect(DecimalStringSchema.safeParse(UINT256_MAX.toString()).success).toBe(true);
  });
  it("rejects negatives, decimals, non-digits and overflow", () => {
    expect(DecimalStringSchema.safeParse("-1").success).toBe(false);
    expect(DecimalStringSchema.safeParse("1.5").success).toBe(false);
    expect(DecimalStringSchema.safeParse("12e3").success).toBe(false);
    expect(DecimalStringSchema.safeParse((UINT256_MAX + 1n).toString()).success).toBe(false);
  });
});

describe("campaignIdFromSlug", () => {
  it("is deterministic, lowercase, 32-byte hex", () => {
    const id = campaignIdFromSlug("ph-typhoon-2025");
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(campaignIdFromSlug("ph-typhoon-2025")).toBe(id);
  });
  it("differs per slug", () => {
    expect(campaignIdFromSlug("a")).not.toBe(campaignIdFromSlug("b"));
  });

  // Locked vector — MUST match the Solidity keccak256(bytes("ph-typhoon-2025"))
  // asserted in packages/contracts/test/SlugParity.t.sol (cross-language parity).
  it("matches the on-chain keccak256 preimage (locked vector)", () => {
    expect(campaignIdFromSlug("ph-typhoon-2025")).toBe(
      "0xbf7a34a4229c6d591cdbe7c0bb1287e840a73126b5758d58ae14f270ab9913d2",
    );
  });
});

describe("ReleaseType ordinal mapping", () => {
  it("matches the Solidity enum order", () => {
    expect(RELEASE_TYPE_LABEL).toEqual(["PARAMETRIC", "MILESTONE"]);
    expect(releaseTypeFromOrdinal(0)).toBe("PARAMETRIC");
    expect(releaseTypeFromOrdinal(1)).toBe("MILESTONE");
    expect(() => releaseTypeFromOrdinal(2)).toThrow();
  });
});

describe("CreateCampaignSchema (mass-assignment guard)", () => {
  const base = {
    campaignId: "0x" + "1".repeat(64),
    type: "disaster",
    cause: "Typhoon relief",
    name: "PH Typhoon 2025",
    country: "PH",
    releaseType: "PARAMETRIC",
    recipientOrg: "Relief Org",
  };
  it("accepts a well-formed body", () => {
    expect(CreateCampaignSchema.safeParse(base).success).toBe(true);
  });
  it("rejects indexer-owned fields (strict)", () => {
    expect(
      CreateCampaignSchema.safeParse({ ...base, registeredOnChain: true }).success,
    ).toBe(false);
    expect(CreateCampaignSchema.safeParse({ ...base, active: true }).success).toBe(false);
  });
});
