import { Injectable } from "@nestjs/common";
import type { LedgerEntry } from "@amanah/shared";
import type { DonationLog, PayoutDecision, EventIndex } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import { bigIntToString, decToString, toIso } from "../common/map";

// Non-typed lifecycle events live only in EventIndex (no typed projection).
const LIFECYCLE_EVENTS = ["TriggerFired", "MilestoneApproved", "TriggerRevoked"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merged, time-ordered glass-box view. Confirmed money rows come from the typed
   * tables (an entity spans multiple events, so it can't dedupe against EventIndex
   * by (txHash,logIndex)); EventIndex supplies only the lifecycle events. Campaign
   * names are batch-loaded with a single `in` query (no N+1). Expired pending rows
   * are excluded; confirmed rows are never duplicated across sources.
   */
  async getLedger(limitInput?: number): Promise<LedgerEntry[]> {
    const limit = clampLimit(limitInput);

    const [donations, payouts, lifecycle] = await Promise.all([
      this.prisma.donationLog.findMany({
        where: { status: { not: "expired" } },
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      }),
      this.prisma.payoutDecision.findMany({
        orderBy: [{ updatedAt: "desc" }],
        take: limit,
      }),
      this.prisma.eventIndex.findMany({
        where: { eventName: { in: LIFECYCLE_EVENTS } },
        orderBy: [{ blockNumber: "desc" }, { logIndex: "desc" }],
        take: limit,
      }),
    ]);

    const ids = unique([
      ...donations.map((d) => d.campaignId),
      ...payouts.map((p) => p.campaignId),
      ...lifecycle.map((l) => l.campaignId).filter((c): c is string => c !== null),
    ]);
    const campaigns = await this.prisma.campaign.findMany({
      where: { campaignId: { in: ids } },
      select: { campaignId: true, name: true },
    });
    const nameById = new Map(campaigns.map((c) => [c.campaignId, c.name]));

    const entries: LedgerEntry[] = [
      ...donations.map((d) => donationEntry(d, nameById.get(d.campaignId) ?? null)),
      ...payouts.map((p) => payoutEntry(p, nameById.get(p.campaignId) ?? null)),
      ...lifecycle.map((l) => lifecycleEntry(l, l.campaignId ? (nameById.get(l.campaignId) ?? null) : null)),
    ];
    entries.sort(ledgerSort);
    return entries.slice(0, limit);
  }
}

function clampLimit(n?: number): number {
  if (!n || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

/**
 * Chain order, newest first: by (blockNumber, logIndex) desc for rows that have a
 * block. Block-less rows — optimistic pending donations and payouts (which
 * aggregate multiple txs) — pin to the top ordered by createdAt desc. Must NOT
 * sort confirmed rows by createdAt: that is the indexer transaction's now(),
 * constant across an entire chunk, which collapses a chunk's blocks to one key.
 */
export function ledgerSort(a: LedgerEntry, b: LedgerEntry): number {
  const aBlockless = a.blockNumber === null;
  const bBlockless = b.blockNumber === null;
  if (aBlockless !== bBlockless) return aBlockless ? -1 : 1; // block-less pinned to top

  if (!aBlockless && !bBlockless && a.blockNumber !== b.blockNumber) {
    return BigInt(a.blockNumber!) < BigInt(b.blockNumber!) ? 1 : -1; // block desc
  }
  const al = a.logIndex ?? -1;
  const bl = b.logIndex ?? -1;
  if (al !== bl) return bl - al; // logIndex desc
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1; // createdAt desc
  return 0;
}

function donationEntry(d: DonationLog, campaignName: string | null): LedgerEntry {
  return {
    kind: "donation",
    eventName: "Donated",
    blockNumber: bigIntToString(d.blockNumber),
    logIndex: d.status === "confirmed" ? d.logIndex : null,
    txHash: d.txHash,
    campaignId: d.campaignId,
    campaignName,
    status: d.status,
    // consentHash intentionally excluded.
    payload: {
      donor: d.donor,
      stablecoin: d.stablecoin,
      amountIn: decToString(d.amountIn),
      baseOut: decToString(d.baseOut),
    },
    createdAt: toIso(d.createdAt),
  };
}

function payoutEntry(p: PayoutDecision, campaignName: string | null): LedgerEntry {
  return {
    kind: "payout",
    eventName: PAYOUT_EVENT_NAME[p.status],
    blockNumber: null, // PayoutDecision aggregates multiple txs; ordered by time
    logIndex: null,
    txHash: p.routedTxHash ?? p.releasedTxHash ?? null,
    campaignId: p.campaignId,
    campaignName,
    status: p.status,
    payload: {
      beneficiary: p.beneficiary,
      usdcAmount: decToString(p.usdcAmount),
      rail: p.rail,
      feeBpsCovered: p.feeBpsCovered,
      rationale: p.rationale,
      releasedTxHash: p.releasedTxHash,
      routedTxHash: p.routedTxHash,
    },
    createdAt: toIso(p.updatedAt),
  };
}

const PAYOUT_EVENT_NAME: Record<PayoutDecision["status"], string> = {
  pending: "PayoutPending",
  released: "TrancheReleased",
  routed: "Routed",
  cancelled: "PendingCancelled",
};

function lifecycleEntry(l: EventIndex, campaignName: string | null): LedgerEntry {
  return {
    kind: "lifecycle",
    eventName: l.eventName,
    blockNumber: bigIntToString(l.blockNumber),
    logIndex: l.logIndex,
    txHash: l.txHash,
    campaignId: l.campaignId,
    campaignName,
    status: "confirmed",
    payload: (l.payloadJson ?? {}) as Record<string, unknown>,
    createdAt: toIso(l.createdAt),
  };
}
