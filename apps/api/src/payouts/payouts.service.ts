import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { normalizeHex, type CreatePayout, type PayoutResponse } from "@amanah/shared";
import { upsertPendingPayout, type PayoutDecision } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import { bigIntToString, decToString, toIso } from "../common/map";

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Optimistic write. Only fills a still-pending row; the indexer's write-once
   *  state machine (released/routed/cancelled) always wins. */
  async create(input: CreatePayout): Promise<PayoutResponse> {
    const payoutId = normalizeHex(input.payoutId);
    await upsertPendingPayout(this.prisma, {
      payoutId,
      campaignId: normalizeHex(input.campaignId),
      beneficiary: normalizeHex(input.beneficiary),
      usdcAmount: input.usdcAmount,
      rail: input.rail ?? null,
      feeBpsCovered: input.feeBpsCovered ?? null,
      rationale: input.rationale ?? null,
      fallbackUsed: input.fallbackUsed ?? null,
    });
    const row = await this.prisma.payoutDecision.findUnique({ where: { payoutId } });
    if (!row) throw new InternalServerErrorException("payout not found after write");
    return toPayoutResponse(row);
  }

  async findAll(): Promise<PayoutResponse[]> {
    const rows = await this.prisma.payoutDecision.findMany({
      where: { status: { not: "expired" } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toPayoutResponse);
  }
}

export function toPayoutResponse(p: PayoutDecision): PayoutResponse {
  return {
    payoutId: p.payoutId,
    campaignId: p.campaignId,
    beneficiary: p.beneficiary,
    usdcAmount: decToString(p.usdcAmount),
    rail: p.rail,
    feeBpsCovered: p.feeBpsCovered,
    rationale: p.rationale,
    fallbackUsed: p.fallbackUsed,
    status: p.status,
    unlockTime: bigIntToString(p.unlockTime),
    releasedTxHash: p.releasedTxHash,
    routedTxHash: p.routedTxHash,
    createdAt: toIso(p.createdAt),
  };
}
