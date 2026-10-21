import { describe, it, expect, vi } from "vitest";
import { CampaignsService } from "../src/campaigns/campaigns.service";

const dbRow = (campaignId: string) => ({
  id: "c1",
  campaignId,
  type: "disaster",
  cause: "Typhoon relief",
  name: "PH Typhoon",
  country: "PH",
  releaseType: "PARAMETRIC",
  recipientOrg: "Relief Org",
  active: true,
  registeredOnChain: false,
  createdAt: new Date("2026-10-21T00:00:00Z"),
  updatedAt: new Date("2026-10-21T00:00:00Z"),
});

function makeService() {
  const executeRaw = vi.fn(async () => 1);
  const findUnique = vi.fn(async (args: { where: { campaignId: string } }) => dbRow(args.where.campaignId));
  const prisma = { $executeRaw: executeRaw, campaign: { findUnique } } as never;
  return { service: new CampaignsService(prisma), executeRaw, findUnique };
}

const base = {
  campaignId: "0x" + "A".repeat(64), // mixed-case input
  type: "disaster" as const,
  cause: "Typhoon relief",
  name: "PH Typhoon",
  country: "PH",
  releaseType: "PARAMETRIC" as const,
  recipientOrg: "Relief Org",
};

describe("CampaignsService.create", () => {
  it("lowercases campaignId before the write + read-back", async () => {
    const { service, findUnique } = makeService();
    await service.create(base);
    const arg = findUnique.mock.calls[0]![0] as { where: { campaignId: string } };
    expect(arg.where.campaignId).toBe("0x" + "a".repeat(64));
  });

  it("writes through the fill-when-absent repository (raw upsert)", async () => {
    const { service, executeRaw } = makeService();
    await service.create(base);
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("returns an ISO createdAt string (no Date leak) and surfaces registeredOnChain", async () => {
    const { service } = makeService();
    const res = await service.create(base);
    expect(res.createdAt).toBe("2026-10-21T00:00:00.000Z");
    expect(res.registeredOnChain).toBe(false);
  });
});
