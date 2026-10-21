import { Controller, Get, Query } from "@nestjs/common";
import { LedgerService } from "./ledger.service";

@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  get(@Query("limit") limit?: string) {
    const n = limit ? Number(limit) : undefined;
    return this.ledger.getLedger(Number.isFinite(n) ? n : undefined);
  }
}
