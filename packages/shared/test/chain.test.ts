import { describe, it, expect } from "vitest";
import { CHAIN_ID, CHAIN_NAME, EXPLORER_URL, txUrl } from "../src/index.js";

describe("chain explorer", () => {
  it("exposes Base Sepolia constants", () => {
    expect(CHAIN_ID).toBe(84532);
    expect(CHAIN_NAME).toBe("Base Sepolia");
  });

  it("points at the Base Sepolia BaseScan (not mainnet)", () => {
    expect(EXPLORER_URL).toBe("https://sepolia.basescan.org");
  });

  it("builds a tx deep link", () => {
    const hash = "0x" + "a".repeat(64);
    expect(txUrl(hash)).toBe(`https://sepolia.basescan.org/tx/${hash}`);
  });
});
