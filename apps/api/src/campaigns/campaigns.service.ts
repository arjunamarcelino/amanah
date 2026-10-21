import { Injectable } from "@nestjs/common";
import { normalizeHex, type CampaignResponse, type CreateCampaign } from "@amanah/shared";
import type { Campaign } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import { toIso } from "../common/map";

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(type?: string): Promise<CampaignResponse[]> {
    const rows = await this.prisma.campaign.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toCampaignResponse);
  }

  /**
   * Offchain metadata only — never registers on-chain. The `update` branch writes
   * metadata exclusively, so it never clobbers the indexer-owned `registeredOnChain`
   * / `active` columns.
   */
  async create(input: CreateCampaign): Promise<CampaignResponse> {
    const campaignId = normalizeHex(input.campaignId);
    const metadata = {
      type: input.type,
      cause: input.cause,
      name: input.name,
      country: input.country,
      releaseType: input.releaseType,
      recipientOrg: input.recipientOrg,
    };
    const row = await this.prisma.campaign.upsert({
      where: { campaignId },
      update: metadata,
      create: { campaignId, ...metadata, active: true },
    });
    return toCampaignResponse(row);
  }
}

export function toCampaignResponse(c: Campaign): CampaignResponse {
  return {
    campaignId: c.campaignId,
    type: c.type as CampaignResponse["type"],
    cause: c.cause,
    name: c.name,
    country: c.country,
    releaseType: c.releaseType,
    recipientOrg: c.recipientOrg,
    active: c.active,
    registeredOnChain: c.registeredOnChain,
    createdAt: toIso(c.createdAt),
  };
}
