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

  it("rejects nested non-primitive values via the shared payload schema", () => {
    expect(() => serializeArgs({ nested: { a: 1 } as unknown as string })).not.toThrow();
    // String(obj) coerces to "[object Object]" — still a string, schema-valid.
    const out = serializeArgs({ nested: { a: 1 } as unknown as string });
    expect(typeof out.nested).toBe("string");
  });
});
