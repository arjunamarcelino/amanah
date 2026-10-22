import { describe, it, expect } from "vitest";
import { asBytes32, asAddress } from "@/lib/hex";

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

describe("asAddress", () => {
  it("accepts a valid address and checksums it", () => {
    const lower = "0x" + "a".repeat(40);
    expect(asAddress(lower)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it("rejects wrong length / non-hex", () => {
    expect(asAddress("0x" + "a".repeat(39))).toBeNull();
    expect(asAddress("0x" + "z".repeat(40))).toBeNull();
    expect(asAddress("nope")).toBeNull();
  });
  it("normalizes any valid-hex address (idempotent EIP-55 checksum)", () => {
    const out = asAddress("0xabcdef0000000000000000000000000000000000");
    expect(out).not.toBeNull();
    expect(out).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(asAddress(out as string)).toBe(out); // idempotent
  });
});
