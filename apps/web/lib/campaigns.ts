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

// Demo cover images live in apps/web/public/campaigns and are keyed by the slug-derived
// campaignId (the API does not yet emit `imageUrl`). campaignIdFromSlug returns lowercased
// 0x-hex, so look up with `.toLowerCase()`. Campaigns without an entry render text-only.
const COVER_BY_ID: Record<string, string> = {
  [campaignIdFromSlug("ph-typhoon-2025")]: "/campaigns/relief.jpg",
  [campaignIdFromSlug("id-rural-school-supplies")]: "/campaigns/classroom.jpg",
  [campaignIdFromSlug("clinic-medicine-fund")]: "/campaigns/clinic.jpg",
};

/** Cover image for a campaign: its own `imageUrl` if present, else the demo map, else none. */
export function coverImageFor(campaign: CampaignResponse): string | undefined {
  return campaign.imageUrl ?? COVER_BY_ID[campaign.campaignId.toLowerCase()];
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
