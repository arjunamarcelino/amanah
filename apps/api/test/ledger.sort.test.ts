import { describe, it, expect } from "vitest";
import { ledgerSort } from "../src/ledger/ledger.service";
import type { LedgerEntry } from "@amanah/shared";

const entry = (
  over: Partial<LedgerEntry> & Pick<LedgerEntry, "createdAt">,
): LedgerEntry => ({
  kind: "donation",
  eventName: "Donated",
  blockNumber: null,
  logIndex: null,
  txHash: null,
  campaignId: null,
  campaignName: null,
  status: "pending",
  payload: {},
  ...over,
});

describe("ledgerSort", () => {
  it("orders block-bearing rows by (blockNumber, logIndex) desc, not createdAt", () => {
    // Same chunk (identical createdAt), different blocks: higher block must win
    // even when its logIndex is lower — the bug this fixes.
    const low = entry({ blockNumber: "100", logIndex: 5, createdAt: "2026-10-21T00:00:00.000Z" });
    const high = entry({ blockNumber: "101", logIndex: 2, createdAt: "2026-10-21T00:00:00.000Z" });
    expect([low, high].sort(ledgerSort)).toEqual([high, low]);
  });

  it("pins block-less (pending/payout) rows above block-bearing rows", () => {
    const pending = entry({ blockNumber: null, createdAt: "2026-10-21T00:00:00.000Z" });
    const confirmed = entry({ blockNumber: "999", logIndex: 0, createdAt: "2026-10-21T00:00:00.000Z" });
    expect([confirmed, pending].sort(ledgerSort)).toEqual([pending, confirmed]);
  });

  it("orders block-less rows by createdAt desc, logIndex desc tiebreak", () => {
    const older = entry({ createdAt: "2026-10-21T00:00:00.000Z", logIndex: 0 });
    const newerA = entry({ createdAt: "2026-10-21T00:05:00.000Z", logIndex: 1 });
    const newerB = entry({ createdAt: "2026-10-21T00:05:00.000Z", logIndex: 3 });
    const sorted = [older, newerA, newerB].sort(ledgerSort);
    expect(sorted[0]!.logIndex).toBe(3);
    expect(sorted[1]!.logIndex).toBe(1);
    expect(sorted[2]).toBe(older);
  });
});
