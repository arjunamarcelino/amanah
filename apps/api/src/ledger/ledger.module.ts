import { Module } from "@nestjs/common";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

// LedgerService queries Prisma directly (typed tables + EventIndex lifecycle) —
// no injection of Donations/Payouts services needed for the merge.
@Module({
  controllers: [LedgerController],
  providers: [LedgerService],
})
export class LedgerModule {}
