import { describe, it, expect } from "vitest";
import { caipToChainId } from "@/lib/caip";

describe("caipToChainId", () => {
  it("parses CAIP-2 eip155 ids", () => {
    expect(caipToChainId("eip155:84532")).toBe(84532);
    expect(caipToChainId("eip155:1")).toBe(1);
  });
  it("returns undefined for empty / non-numeric", () => {
    expect(caipToChainId(undefined)).toBeUndefined();
    expect(caipToChainId("")).toBeUndefined();
    expect(caipToChainId("eip155:abc")).toBeUndefined();
  });
});
