import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@amanah/db";

// Official Nest+Prisma recipe: eager $connect (fail fast) on init, $disconnect on
// destroy. Combined with app.enableShutdownHooks() in main.ts — do NOT use the
// removed `beforeExit` event.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
