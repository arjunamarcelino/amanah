import { describe, it, expect } from "vitest";
import { serializeArgs } from "../src/serialize.js";

describe("serializeArgs", () => {
  it("stringifies bigints and preserves other primitives", () => {
    const out = serializeArgs({
      amountIn: 1_000_000n,
      donor: "0xabc",
      logIndex: 2,
      flag: true,
      none: null,
    });
    expect(out.amountIn).toBe("1000000");
    expect(out.donor).toBe("0xabc");
    expect(out.logIndex).toBe(2);
    expect(out.flag).toBe(true);
    expect(out.none).toBeNull();
  });

  it("JSON-stringifies non-primitive args (preserving nested bigints)", () => {
    const out = serializeArgs({
      tuple: [1n, "x"] as unknown as string,
      struct: { amount: 2n } as unknown as string,
    });
    expect(out.tuple).toBe('["1","x"]');
    expect(out.struct).toBe('{"amount":"2"}');
  });
});
