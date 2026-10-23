import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { CampaignType, normalizeHex, type CampaignResponse, type CreateCampaign } from "@amanah/shared";
import { upsertCampaignMetadata, type Campaign, type Prisma } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import { toIso, decToString } from "../common/map";

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(type?: string): Promise<CampaignResponse[]> {
    const rows = await this.prisma.campaign.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
    });
    // Real raised = sum of CONFIRMED on-chain donations per campaign, in one grouped
    // query (no N+1). Only 'confirmed' counts — pending/expired optimistic rows are not
    // yet verified money, so they must not inflate a public "raised" figure.
    const sums = await this.prisma.donationLog.groupBy({
      by: ["campaignId"],
      where: { status: "confirmed", campaignId: { in: rows.map((r) => r.campaignId) } },
      _sum: { baseOut: true },
    });
    const raisedById = new Map(sums.map((s) => [s.campaignId, s._sum.baseOut]));
    return rows.map((r) => toCampaignResponse(r, raisedById.get(r.campaignId) ?? null));
  }

  /**
   * Offchain metadata only — never registers on-chain. Routed through the
   * fill-when-absent repository upsert so an unauthenticated POST with a known
   * (public) campaignId cannot overwrite a campaign's existing descriptive fields,
   * never clobbers the indexer-owned registeredOnChain/releaseType, and always
   * activates (active=true) regardless of whether an indexer stub pre-created the row.
   */
  async create(input: CreateCampaign): Promise<CampaignResponse> {
    const campaignId = normalizeHex(input.campaignId);
    await upsertCampaignMetadata(this.prisma, {
      campaignId,
      type: input.type,
      cause: input.cause,
      name: input.name,
      country: input.country,
      releaseType: input.releaseType,
      recipientOrg: input.recipientOrg,
    });
    const row = await this.prisma.campaign.findUnique({ where: { campaignId } });
    if (!row) throw new InternalServerErrorException("campaign not found after write");
    return toCampaignResponse(row);
  }
}

export function toCampaignResponse(
  c: Campaign,
  raised: Prisma.Decimal | null = null,
): CampaignResponse {
  return {
    campaignId: c.campaignId,
    // `type` is a free-form String column; validate at the boundary with a safe
    // fallback rather than an unchecked cast (stub/legacy rows may be off-catalog).
    type: CampaignType.catch("general").parse(c.type),
    cause: c.cause,
    name: c.name,
    country: c.country,
    releaseType: c.releaseType,
    recipientOrg: c.recipientOrg,
    active: c.active,
    registeredOnChain: c.registeredOnChain,
    createdAt: toIso(c.createdAt),
    // Exact integer base-units strings (never Number()). Raised defaults to "0".
    baseRaised: raised ? decToString(raised) : "0",
    goalBase: c.goalBase ? decToString(c.goalBase) : null,
  };
}
