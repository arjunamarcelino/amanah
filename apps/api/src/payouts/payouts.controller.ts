import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";
import { CreatePayoutDto } from "./dto/create-payout.dto";

@Controller("payouts")
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  findAll() {
    return this.payouts.findAll();
  }

  @Post()
  @HttpCode(202)
  create(@Body() body: CreatePayoutDto) {
    return this.payouts.create(body);
  }
}
