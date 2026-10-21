import { describe, it, expect } from "vitest";
import { derivePayoutStatus } from "../src/repository";

// Pure mirror of the SQL `status` CASE. The raw ON CONFLICT statements compute
// the same ranking; this locks the ordering (and the cancelled-terminal rule).
describe("derivePayoutStatus", () => {
  const none = { releasedTxHash: null, routedTxHash: null, cancelledAt: null };

  it("is pending with no facts", () => {
    expect(derivePayoutStatus(none)).toBe("pending");
  });

  it("advances released -> routed as facts land (order-independent)", () => {
    expect(derivePayoutStatus({ ...none, releasedTxHash: "0xrel" })).toBe("released");
    expect(derivePayoutStatus({ ...none, routedTxHash: "0xrou" })).toBe("routed");
    // Routed seen before released still ranks as routed (no regression).
    expect(
      derivePayoutStatus({ releasedTxHash: "0xrel", routedTxHash: "0xrou", cancelledAt: null }),
    ).toBe("routed");
  });

  it("cancelled is terminal and wins over released/routed facts", () => {
    expect(
      derivePayoutStatus({ releasedTxHash: "0xrel", routedTxHash: "0xrou", cancelledAt: new Date(0) }),
    ).toBe("cancelled");
    expect(derivePayoutStatus({ ...none, cancelledAt: new Date(0) })).toBe("cancelled");
  });
});
