import { campaignIdFromSlug, type CampaignResponse, type CampaignType } from "@amanah/shared";

// Featured campaign is pinned by slug — no `featured` field exists on the model.
export const FEATURED_SLUG = "ph-typhoon-2025";
export const FEATURED_ID = campaignIdFromSlug(FEATURED_SLUG); // lowercased 0x-hex

// The general-fund sentinel (inactive) must never appear in the grid or hero.
export const ZERO_CAMPAIGN_ID = `0x${"0".repeat(64)}`;

// Cause filter: "all" + the enum order. UI shows only causes actually present.
export const CAUSE_ORDER: CampaignType[] = [
  "disaster",
  "education",
  "medical",
  "poverty",
  "waqf",
  "general",
];
export type CauseChip = "all" | CampaignType;

export function isFeatured(c: CampaignResponse): boolean {
  return c.campaignId.toLowerCase() === FEATURED_ID;
}

/** Campaigns shown in the grid: active and not the zero/general sentinel. */
export function visibleCampaigns(list: CampaignResponse[]): CampaignResponse[] {
  return list.filter((c) => c.active && c.campaignId.toLowerCase() !== ZERO_CAMPAIGN_ID);
}

/** Ordered, distinct cause types present in the list (drives the chip row). */
export function availableCauses(list: CampaignResponse[]): CampaignType[] {
  const present = new Set(list.map((c) => c.type));
  return CAUSE_ORDER.filter((t) => present.has(t));
}

export function filterByCause(list: CampaignResponse[], chip: CauseChip): CampaignResponse[] {
  if (chip === "all") return list;
  return list.filter((c) => c.type === chip);
}

// Enum-keyed class allowlist (S-4): the free-text `type`/`cause` is NEVER
// interpolated into a className. Unknown values fall back to neutral.
const CAUSE_BADGE: Record<CampaignType, string> = {
  disaster: "bg-destructive/10 text-destructive",
  education: "bg-accent text-accent-foreground",
  medical: "bg-accent text-accent-foreground",
  poverty: "bg-secondary text-secondary-foreground",
  waqf: "bg-accent text-accent-foreground",
  general: "bg-muted text-muted-foreground",
};

export function causeBadgeClass(type: string): string {
  return (CAUSE_BADGE as Record<string, string>)[type] ?? "bg-muted text-muted-foreground";
}
