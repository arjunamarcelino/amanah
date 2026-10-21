import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findAll(@Query("type") type?: string) {
    // Unknown ?type= just yields an empty list (never 404/400).
    return this.campaigns.findAll(type);
  }

  // 202: metadata is accepted offchain; on-chain registration is a separate step.
  @Post()
  @HttpCode(202)
  create(@Body() body: CreateCampaignDto) {
    return this.campaigns.create(body);
  }
}
