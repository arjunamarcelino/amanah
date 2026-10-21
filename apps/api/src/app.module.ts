import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { RailsModule } from "./rails/rails.module";
import { DonationsModule } from "./donations/donations.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { LedgerModule } from "./ledger/ledger.module";
import { HealthController } from "./health/health.controller";

// Wiring only — cross-cutting providers live in CoreModule, resources in feature modules.
@Module({
  imports: [CoreModule, CampaignsModule, RailsModule, DonationsModule, PayoutsModule, LedgerModule],
  controllers: [HealthController],
})
export class AppModule {}
