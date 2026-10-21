import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";

const ORPHAN_TTL_MS = 60_000;

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Cache the (full-scan) orphan anti-join so frequent liveness probes don't each
  // pay for it — recompute at most once per TTL.
  private orphanCache: { value: number; at: number } | null = null;

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "error", db: "down" });
    }

    const cursor = await this.prisma.indexerCursor.findFirst({ orderBy: { updatedAt: "desc" } });
    const orphanDonationCampaigns = await this.cachedOrphanCount();

    return {
      status: "ok",
      service: "api",
      db: "up",
      // Indexer liveness proxy: how stale the cursor is (no RPC call from the API).
      indexer: cursor
        ? {
            lastBlock: cursor.lastBlock.toString(),
            updatedAt: cursor.updatedAt.toISOString(),
            staleSeconds: Math.round((Date.now() - cursor.updatedAt.getTime()) / 1000),
          }
        : null,
      // Donations whose campaignId has no Campaign row (FK is non-enforced on purpose).
      orphanDonationCampaigns,
    };
  }

  private async cachedOrphanCount(): Promise<number> {
    const now = Date.now();
    if (this.orphanCache && now - this.orphanCache.at < ORPHAN_TTL_MS) {
      return this.orphanCache.value;
    }
    const value = await this.countOrphanDonationCampaigns();
    this.orphanCache = { value, at: now };
    return value;
  }

  private async countOrphanDonationCampaigns(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT d."campaignId") AS count
      FROM "DonationLog" d
      LEFT JOIN "Campaign" c ON c."campaignId" = d."campaignId"
      WHERE c."campaignId" IS NULL
    `;
    return Number(rows[0]?.count ?? 0n);
  }
}
