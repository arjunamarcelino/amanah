import { Controller, Get, Query } from "@nestjs/common";
import { RailsService } from "./rails.service";

@Controller("rails")
export class RailsController {
  constructor(private readonly rails: RailsService) {}

  @Get()
  findAll(@Query("country") country?: string) {
    return this.rails.findAll(country);
  }
}
