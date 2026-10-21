import { describe, it, expect } from "vitest";
import { Prisma } from "@amanah/db";
import { toDonationResponse } from "../src/donations/donations.service";

const row = {
  id: "d1",
  txHash: "0xabc",
  logIndex: 0,
  blockNumber: 48377014n,
  donor: "0xdonor",
  campaignId: "0xcamp",
  stablecoin: "0xusdc",
  amountIn: new Prisma.Decimal("1000000"),
  baseOut: new Prisma.Decimal("999999"),
  consentHash: "0xsecretcommitment",
  status: "confirmed",
  createdAt: new Date("2026-10-21T00:00:00Z"),
  confirmedAt: new Date("2026-10-21T00:01:00Z"),
};

describe("toDonationResponse", () => {
  it("NEVER leaks consentHash", () => {
    const res = toDonationResponse(row as never);
    expect(res).not.toHaveProperty("consentHash");
    expect(JSON.stringify(res)).not.toContain("secretcommitment");
  });

  it("serializes Decimal and bigint as exact strings", () => {
    const res = toDonationResponse(row as never);
    expect(res.amountIn).toBe("1000000");
    expect(res.baseOut).toBe("999999");
    expect(res.blockNumber).toBe("48377014");
    expect(typeof res.amountIn).toBe("string");
  });
});
