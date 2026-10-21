import { Module } from "@nestjs/common";
import { RailsController } from "./rails.controller";
import { RailsService } from "./rails.service";

@Module({
  controllers: [RailsController],
  providers: [RailsService],
  exports: [RailsService],
})
export class RailsModule {}
