import { describe, it, expect } from "vitest";
import type { LedgerEntry } from "@amanah/shared";
import { mergeLedger, ledgerDisplayAmount, ledgerKey } from "@/lib/ledger";

function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    kind: "lifecycle",
    eventName: "YieldAccrued",
    blockNumber: "100",
    logIndex: 0,
    txHash: ("0x" + "1".repeat(64)) as string,
    campaignId: null,
    campaignName: null,
    status: "confirmed",
    payload: {},
    createdAt: "",
    ...over,
  };
}

describe("ledgerDisplayAmount", () => {
  it("renders an API base-units string and a chain base-units string identically", () => {
    const apiRow = entry({ kind: "donation", eventName: "Donated", payload: { amountIn: "100000000" } });
    const chainRow = entry({ kind: "lifecycle", eventName: "Invested", payload: { amount: "100000000" } });
    expect(ledgerDisplayAmount(apiRow)).toBe("100");
    expect(ledgerDisplayAmount(chainRow)).toBe("100");
    expect(ledgerDisplayAmount(apiRow)).toBe(ledgerDisplayAmount(chainRow));
  });

  it("reads usdcAmount for payout rows", () => {
    expect(ledgerDisplayAmount(entry({ kind: "payout", eventName: "Routed", payload: { usdcAmount: "1500000" } }))).toBe("1.5");
  });

  it("returns null when the amount is absent or non-integer", () => {
    expect(ledgerDisplayAmount(entry({ kind: "lifecycle", eventName: "TriggerFired", payload: { detail: "x" } }))).toBeNull();
    expect(ledgerDisplayAmount(entry({ kind: "payout", payload: { usdcAmount: "1.5" } }))).toBeNull();
  });
});

describe("mergeLedger", () => {
  it("dedupes confirmed rows by (txHash, logIndex)", () => {
    const tx = ("0x" + "a".repeat(64)) as string;
    const a = entry({ txHash: tx, logIndex: 2, blockNumber: "50" });
    const dup = entry({ txHash: tx.toUpperCase(), logIndex: 2, blockNumber: "50" });
    expect(mergeLedger([a], [dup])).toHaveLength(1);
  });

  it("orders by block desc and pins block-less (optimistic) rows to the top", () => {
    const optimistic = entry({ txHash: null, logIndex: null, blockNumber: null, createdAt: "2026-01-01T00:00:00Z" });
    const low = entry({ txHash: ("0x" + "b".repeat(64)) as string, logIndex: 0, blockNumber: "10" });
    const high = entry({ txHash: ("0x" + "c".repeat(64)) as string, logIndex: 0, blockNumber: "99" });
    const sorted = mergeLedger([low, high], [optimistic]);
    expect(sorted[0]).toBe(optimistic); // block-less pinned top
    expect(sorted[1].blockNumber).toBe("99"); // then block desc
    expect(sorted[2].blockNumber).toBe("10");
  });

  it("keeps multiple optimistic rows (no false dedup on null keys)", () => {
    const o1 = entry({ txHash: null, logIndex: null, blockNumber: null, eventName: "PayoutPending" });
    const o2 = entry({ txHash: null, logIndex: null, blockNumber: null, eventName: "Donated", kind: "donation" });
    expect(mergeLedger([o1, o2], [])).toHaveLength(2);
  });
});

describe("ledgerKey", () => {
  it("uses (txHash, logIndex) when present", () => {
    expect(ledgerKey(entry({ txHash: "0xabc", logIndex: 3 }))).toBe("0xabc:3");
  });
  it("falls back for block-less rows", () => {
    expect(ledgerKey(entry({ txHash: null, logIndex: null, kind: "payout", eventName: "PayoutPending", campaignId: "0xc", createdAt: "t1" }))).toBe("payout:PayoutPending:0xc:t1");
  });
});
