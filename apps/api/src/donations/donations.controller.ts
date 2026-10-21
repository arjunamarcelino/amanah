import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { DonationsService } from "./donations.service";
import { CreateDonationDto } from "./dto/create-donation.dto";

@Controller("donations")
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get()
  findAll() {
    return this.donations.findAll();
  }

  // 202: the row is optimistic/pending; the indexer confirms from chain.
  @Post()
  @HttpCode(202)
  create(@Body() body: CreateDonationDto) {
    return this.donations.create(body);
  }
}
