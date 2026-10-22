import { describe, it, expect } from "vitest";
import { asBytes32 } from "@/lib/hex";

describe("asBytes32", () => {
  it("accepts and lowercases 32-byte hex", () => {
    expect(asBytes32("0x" + "A".repeat(64))).toBe("0x" + "a".repeat(64));
    expect(asBytes32("  0x" + "b".repeat(64) + "  ")).toBe("0x" + "b".repeat(64));
  });
  it("rejects wrong length / non-hex / missing prefix", () => {
    expect(asBytes32("0x" + "a".repeat(63))).toBeNull();
    expect(asBytes32("0x" + "z".repeat(64))).toBeNull();
    expect(asBytes32("a".repeat(64))).toBeNull();
    expect(asBytes32("")).toBeNull();
  });
});
