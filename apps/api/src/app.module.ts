import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { RailsModule } from "./rails/rails.module";
import { DonationsModule } from "./donations/donations.module";
import { HealthController } from "./health/health.controller";

// Wiring only — cross-cutting providers live in CoreModule, resources in feature modules.
@Module({
  imports: [CoreModule, CampaignsModule, RailsModule, DonationsModule],
  controllers: [HealthController],
})
export class AppModule {}
