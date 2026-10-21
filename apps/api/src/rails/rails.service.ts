import { Injectable } from "@nestjs/common";
import type { RailResponse } from "@amanah/shared";
import type { Rail } from "@amanah/db";
import { PrismaService } from "../core/prisma/prisma.service";

@Injectable()
export class RailsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active off-ramp candidates, cheapest first. Optionally filtered by country. */
  async findAll(country?: string): Promise<RailResponse[]> {
    const rows = await this.prisma.rail.findMany({
      where: { active: true, ...(country ? { country } : {}) },
      orderBy: { feeBps: "asc" },
    });
    return rows.map(toRailResponse);
  }
}

export function toRailResponse(r: Rail): RailResponse {
  return {
    id: r.id,
    name: r.name,
    country: r.country,
    feeBps: r.feeBps,
    liquidity: r.liquidity,
    etaMinutes: r.etaMinutes,
    active: r.active,
  };
}
