import { describe, it, expect } from "vitest";
import { parseTokenAmount, formatTokenAmount } from "@/lib/amount";

describe("parseTokenAmount (6 decimals)", () => {
  it("parses a plain decimal to base units", () => {
    expect(parseTokenAmount("1")).toEqual({ ok: true, value: 1_000000n });
    expect(parseTokenAmount("1.5")).toEqual({ ok: true, value: 1_500000n });
    expect(parseTokenAmount("0.000001")).toEqual({ ok: true, value: 1n });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "not_numeric"],
    ["-1", "not_numeric"],
    ["1e5", "not_numeric"],
    ["1,000", "not_numeric"],
    ["1 000", "not_numeric"],
    ["0", "not_positive"],
    ["0.0", "not_positive"],
    ["1.1234567", "too_many_decimals"],
  ])("rejects %j as %s", (input, error) => {
    expect(parseTokenAmount(input)).toEqual({ ok: false, error });
  });

  it("rejects values above uint256 max", () => {
    const huge = (10n ** 90n).toString();
    expect(parseTokenAmount(huge)).toEqual({ ok: false, error: "too_large" });
  });

  it("round-trips via formatTokenAmount", () => {
    const r = parseTokenAmount("12.345678");
    expect(r.ok && formatTokenAmount(r.value)).toBe("12.345678");
  });
});
