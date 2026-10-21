import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { expirePendingDonations, expirePendingPayouts } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";
import type { Env } from "../core/config/env.schema";

/**
 * Expires optimistic donation AND payout rows that never got a matching on-chain
 * event, so spoofed/dropped-tx rows self-clean and drop out of the confirmed/default
 * views. Routed through the @amanah/db repository (the single writer of the money
 * tables) and served by the partial indexes on (createdAt) WHERE status='pending',
 * so each stays O(pending). A confirmed/released row is never touched (the
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
    const donations = await expirePendingDonations(this.prisma, cutoff);
    const payouts = await expirePendingPayouts(this.prisma, cutoff);
    if (donations + payouts > 0) {
      this.logger.log(`expired ${donations} pending donation(s), ${payouts} pending payout(s)`);
    }
    return donations + payouts;
  }
}
