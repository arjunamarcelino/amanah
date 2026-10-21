import { describe, it, expect } from "vitest";
import { campaignIdFromSlug, START_BLOCK, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { PrismaClient, confirmDonation, applyRouted } from "@amanah/db";

// Proves the ESM indexer resolves both the ESM shared package AND the CJS db
// package (named imports from CJS). Catches an exports-map regression at test
// time rather than at runtime.
describe("workspace interop", () => {
  it("resolves @amanah/shared (ESM) named exports", () => {
    expect(typeof campaignIdFromSlug).toBe("function");
    expect(typeof START_BLOCK).toBe("number");
    expect(ADDRESSES[CHAIN_ID].CharityPool).toMatch(/^0x/);
  });

  it("resolves @amanah/db (CJS) named exports from ESM", () => {
    expect(typeof PrismaClient).toBe("function");
    expect(typeof confirmDonation).toBe("function");
    expect(typeof applyRouted).toBe("function");
  });
});
