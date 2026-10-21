import { Injectable, NotFoundException } from "@nestjs/common";
import { normalizeHex, type CreateDonation, type DonationResponse } from "@amanah/shared";
import { upsertPendingDonation, type DonationLog } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import { bigIntToString, decToString, toIso } from "../common/map";

@Injectable()
export class DonationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Optimistic write. Status is hard-coded 'pending' by the repository; a late
   *  POST can never downgrade an already-confirmed row (ON CONFLICT WHERE guard). */
  async create(input: CreateDonation): Promise<DonationResponse> {
    const txHash = normalizeHex(input.txHash);
    const logIndex = input.logIndex ?? 0;
    await upsertPendingDonation(this.prisma, {
      txHash,
      logIndex,
      donor: normalizeHex(input.donor),
      campaignId: normalizeHex(input.campaignId),
      stablecoin: normalizeHex(input.stablecoin),
      amountIn: input.amountIn,
      baseOut: input.baseOut,
      consentHash: normalizeHex(input.consentHash),
    });
    const row = await this.prisma.donationLog.findUnique({
      where: { txHash_logIndex: { txHash, logIndex } },
    });
    if (!row) throw new NotFoundException("donation not found after write");
    return toDonationResponse(row);
  }

  async findAll(): Promise<DonationResponse[]> {
    const rows = await this.prisma.donationLog.findMany({
      where: { status: { not: "expired" } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDonationResponse);
  }
}

// consentHash is deliberately omitted — it must never reach a response body.
export function toDonationResponse(d: DonationLog): DonationResponse {
  return {
    txHash: d.txHash,
    logIndex: d.logIndex,
    blockNumber: bigIntToString(d.blockNumber),
    donor: d.donor,
    campaignId: d.campaignId,
    stablecoin: d.stablecoin,
    amountIn: decToString(d.amountIn),
    baseOut: decToString(d.baseOut),
    status: d.status,
    createdAt: toIso(d.createdAt),
    confirmedAt: d.confirmedAt ? toIso(d.confirmedAt) : null,
  };
}
