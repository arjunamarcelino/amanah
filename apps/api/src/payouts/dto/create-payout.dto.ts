import { createZodDto } from "nestjs-zod";
import { CreatePayoutSchema } from "@amanah/shared";

export class CreatePayoutDto extends createZodDto(CreatePayoutSchema) {}
