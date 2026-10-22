import { describe, it, expect } from "vitest";
import { clampedYield } from "@/lib/yield";

describe("clampedYield", () => {
  it("returns poolValue − totalSupply when positive", () => {
    expect(clampedYield(1_000_000n, 600_000n)).toBe(400_000n);
  });
  it("clamps to 0 when poolValue < totalSupply (mid-rebalance dip)", () => {
    expect(clampedYield(500_000n, 600_000n)).toBe(0n);
  });
  it("is 0 when equal", () => {
    expect(clampedYield(600_000n, 600_000n)).toBe(0n);
  });
});
