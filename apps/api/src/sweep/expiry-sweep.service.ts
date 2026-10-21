import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../core/prisma/prisma.service";
import type { Env } from "../core/config/env.schema";

/**
 * Expires optimistic donation rows that never got a matching on-chain event, so
 * spoofed/dropped-tx rows self-clean and are dropped from the confirmed/default
 * view. Served by the partial index on (createdAt) WHERE status='pending', so
 * this stays O(pending), not a full-table scan.
 *
 * Only DonationLog has an `expired` state; a confirmed row is never touched (the
 * WHERE status='pending' guard), so a confirm landing mid-sweep is safe.
 */
@Injectable()
export class ExpirySweepService {
  private readonly logger = new Logger(ExpirySweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<number> {
    const ttlMin = this.config.get("PENDING_TTL_MIN", { infer: true });
    const cutoff = new Date(Date.now() - ttlMin * 60_000);
    const { count } = await this.prisma.donationLog.updateMany({
      where: { status: "pending", createdAt: { lt: cutoff } },
      data: { status: "expired" },
    });
    if (count > 0) this.logger.log(`expired ${count} stale pending donation(s)`);
    return count;
  }
}
