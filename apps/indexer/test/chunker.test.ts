import { describe, it, expect } from "vitest";
import { nextChunkEnd, halve, regrow, isRangeOrResultCap } from "../src/chunker.js";

describe("chunker", () => {
  it("clamps the chunk end to toBlock", () => {
    expect(nextChunkEnd(100n, 50n, 1000n)).toBe(149n);
    expect(nextChunkEnd(980n, 50n, 1000n)).toBe(1000n);
    expect(nextChunkEnd(1000n, 50n, 1000n)).toBe(1000n);
  });

  it("halves down to a floor of 1", () => {
    expect(halve(10000n)).toBe(5000n);
    expect(halve(1n)).toBe(1n);
    expect(halve(3n)).toBe(1n);
  });

  it("re-grows but never exceeds max", () => {
    expect(regrow(2500n, 10000n)).toBe(5000n);
    expect(regrow(8000n, 10000n)).toBe(10000n);
  });

  it("detects provider range/result caps", () => {
    expect(isRangeOrResultCap(new Error("query returned more than 10000 results"))).toBe(true);
    expect(isRangeOrResultCap(new Error("block range is too wide"))).toBe(true);
    expect(isRangeOrResultCap(new Error("connection refused"))).toBe(false);
  });
});
