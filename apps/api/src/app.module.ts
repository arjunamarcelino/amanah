import { Module } from "@nestjs/common";
import { CoreModule } from "./core/core.module";
import { HealthController } from "./health/health.controller";

// Wiring only — cross-cutting providers live in CoreModule, resources in feature modules.
@Module({
  imports: [CoreModule],
  controllers: [HealthController],
})
export class AppModule {}
