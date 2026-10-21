import { createZodDto } from "nestjs-zod";
import { CreateDonationSchema } from "@amanah/shared";

export class CreateDonationDto extends createZodDto(CreateDonationSchema) {}
