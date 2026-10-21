import { describe, it, expect } from "vitest";
import { ledgerSort } from "../src/ledger/ledger.service";
import type { LedgerEntry } from "@amanah/shared";

const entry = (createdAt: string, logIndex: number | null): LedgerEntry => ({
  kind: "donation",
  eventName: "Donated",
  blockNumber: null,
  logIndex,
  txHash: null,
  campaignId: null,
  campaignName: null,
  status: "pending",
  payload: {},
  createdAt,
});

describe("ledgerSort", () => {
  it("orders newest createdAt first, logIndex desc as tiebreak", () => {
    const list = [
      entry("2026-10-21T00:00:00.000Z", 0),
      entry("2026-10-21T00:05:00.000Z", 1),
      entry("2026-10-21T00:05:00.000Z", 3),
    ];
    const sorted = [...list].sort(ledgerSort);
    expect(sorted.map((e) => e.createdAt)).toEqual([
      "2026-10-21T00:05:00.000Z",
      "2026-10-21T00:05:00.000Z",
      "2026-10-21T00:00:00.000Z",
    ]);
    // tiebreak within same timestamp: higher logIndex first
    expect(sorted[0]!.logIndex).toBe(3);
    expect(sorted[1]!.logIndex).toBe(1);
  });
});
