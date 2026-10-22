import { describe, it, expect } from "vitest";
import type { CampaignResponse, CampaignType } from "@amanah/shared";
import {
  FEATURED_ID,
  ZERO_CAMPAIGN_ID,
  isFeatured,
  visibleCampaigns,
  availableCauses,
  filterByCause,
  causeBadgeClass,
} from "@/lib/campaigns";

function campaign(over: Partial<CampaignResponse> & { campaignId: string; type: CampaignType }): CampaignResponse {
  return {
    cause: "x",
    name: "x",
    country: "PH",
    releaseType: "PARAMETRIC",
    recipientOrg: "org",
    active: true,
    registeredOnChain: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const featured = campaign({ campaignId: FEATURED_ID, type: "disaster" });
const edu = campaign({ campaignId: "0x" + "1".repeat(64), type: "education" });
const inactive = campaign({ campaignId: "0x" + "2".repeat(64), type: "medical", active: false });
const general = campaign({ campaignId: ZERO_CAMPAIGN_ID, type: "general", active: false });
const list = [featured, edu, inactive, general];

describe("isFeatured", () => {
  it("matches the pinned slug id (case-insensitive)", () => {
    expect(isFeatured(featured)).toBe(true);
    expect(isFeatured({ ...featured, campaignId: FEATURED_ID.toUpperCase() })).toBe(true);
    expect(isFeatured(edu)).toBe(false);
  });
});

describe("visibleCampaigns", () => {
  it("drops inactive and the zero/general sentinel", () => {
    const vis = visibleCampaigns(list);
    expect(vis).toContain(featured);
    expect(vis).toContain(edu);
    expect(vis).not.toContain(inactive);
    expect(vis).not.toContain(general);
  });
});

describe("availableCauses", () => {
  it("returns distinct present causes in enum order", () => {
    expect(availableCauses([edu, featured])).toEqual(["disaster", "education"]);
  });
});

describe("filterByCause", () => {
  it("'all' returns everything; a cause filters", () => {
    expect(filterByCause([featured, edu], "all")).toHaveLength(2);
    expect(filterByCause([featured, edu], "education")).toEqual([edu]);
  });
});

describe("causeBadgeClass", () => {
  it("maps known causes and falls back to neutral for unknown", () => {
    expect(causeBadgeClass("disaster")).toContain("destructive");
    expect(causeBadgeClass("totally-made-up")).toBe("bg-muted text-muted-foreground");
  });
});
