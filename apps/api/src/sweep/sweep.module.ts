import { Module } from "@nestjs/common";
import { ExpirySweepService } from "./expiry-sweep.service";

@Module({
  providers: [ExpirySweepService],
})
export class SweepModule {}
