import { describe, it, expect, vi } from "vitest";
import { CampaignsService } from "../src/campaigns/campaigns.service";

function makeService() {
  const upsert = vi.fn(async (args: { create: Record<string, unknown> }) => ({
    id: "c1",
    campaignId: args.create.campaignId,
    type: "disaster",
    cause: "x",
    name: "x",
    country: "PH",
    releaseType: "PARAMETRIC",
    recipientOrg: "org",
    active: true,
    registeredOnChain: false,
    createdAt: new Date("2026-10-21T00:00:00Z"),
    updatedAt: new Date("2026-10-21T00:00:00Z"),
  }));
  const prisma = { campaign: { upsert } } as never;
  return { service: new CampaignsService(prisma), upsert };
}

describe("CampaignsService.create", () => {
  const base = {
    campaignId: "0x" + "A".repeat(64), // mixed-case input
    type: "disaster" as const,
    cause: "Typhoon relief",
    name: "PH Typhoon",
    country: "PH",
    releaseType: "PARAMETRIC" as const,
    recipientOrg: "Relief Org",
  };

  it("lowercases campaignId before writing", async () => {
    const { service, upsert } = makeService();
    await service.create(base);
    const arg = upsert.mock.calls[0]![0] as { where: { campaignId: string } };
    expect(arg.where.campaignId).toBe("0x" + "a".repeat(64));
  });

  it("never writes indexer-owned fields on update", async () => {
    const { service, upsert } = makeService();
    await service.create(base);
    const arg = upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(arg.update).not.toHaveProperty("registeredOnChain");
    expect(arg.update).not.toHaveProperty("active");
  });

  it("returns an ISO createdAt string (no Date leak)", async () => {
    const { service } = makeService();
    const res = await service.create(base);
    expect(res.createdAt).toBe("2026-10-21T00:00:00.000Z");
    expect(res.registeredOnChain).toBe(false);
  });
});
