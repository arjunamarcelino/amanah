import { describe, it, expect } from "vitest";
import { tokenByKey, STABLECOINS } from "@/lib/tokens";

describe("tokenByKey", () => {
  it("returns the address for every stablecoin key", () => {
    for (const s of STABLECOINS) {
      expect(tokenByKey(s.key)).toBe(s.address);
      expect(tokenByKey(s.key)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
