import { createZodDto } from "nestjs-zod";
import { CreateCampaignSchema } from "@amanah/shared";

// .strict() schema — blocks mass-assignment of indexer-owned fields (status,
// registeredOnChain, active, …). createZodDto wires it to the global pipe.
export class CreateCampaignDto extends createZodDto(CreateCampaignSchema) {}
