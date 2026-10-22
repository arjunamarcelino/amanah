import { describe, it, expect } from "vitest";
import { txErrorMessage } from "@/lib/txError";

describe("txErrorMessage", () => {
  it("prefers viem's shortMessage", () => {
    expect(txErrorMessage({ shortMessage: "User rejected the request", message: "long…" })).toBe(
      "User rejected the request",
    );
  });
  it("falls back to message", () => {
    expect(txErrorMessage({ message: "boom" })).toBe("boom");
  });
  it("handles non-error values", () => {
    expect(txErrorMessage(null)).toBe("Transaction failed");
    expect(txErrorMessage("x")).toBe("Transaction failed");
    expect(txErrorMessage({})).toBe("Transaction failed");
  });
});
