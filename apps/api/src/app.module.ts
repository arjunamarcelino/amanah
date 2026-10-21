import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { HealthController } from "./health/health.controller";

// Wiring only — cross-cutting providers live in CoreModule, resources in feature modules.
@Module({
  imports: [CoreModule, CampaignsModule],
  controllers: [HealthController],
})
export class AppModule {}
