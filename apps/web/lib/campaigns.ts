import { campaignIdFromSlug, type CampaignResponse, type CampaignType } from "@amanah/shared";
import type { Cause } from "@amanah/ui/cause-icon";

// Compile-time guard: @amanah/ui can't depend on @amanah/shared, so CauseIcon's `Cause`
// key set is maintained independently. This app imports both, so assert they stay equal —
// adding/removing a CampaignType without updating the icon catalog fails the build here.
type _Expect<T extends true> = T;
type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _CauseMirror = _Expect<_Equal<Cause, CampaignType>>;

// Featured campaign is pinned by slug — no `featured` field exists on the model.
export const FEATURED_SLUG = "ph-typhoon-2025";
export const FEATURED_ID = campaignIdFromSlug(FEATURED_SLUG); // lowercased 0x-hex

// The general-fund sentinel (inactive) must never appear in the grid or hero.
export const ZERO_CAMPAIGN_ID = `0x${"0".repeat(64)}`;

// Known demo slugs → their derived campaignId. campaignId = campaignIdFromSlug(slug) is
// deterministic (one-way), so this reverse map gives pretty /f/<slug> URLs without a DB
// `slug` column. Campaigns outside the map fall back to the raw campaignId in the URL.
const DEMO_SLUGS = [
  "ph-typhoon-2025",
  "id-rural-school-supplies",
  "clinic-medicine-fund",
  "masjid-waqf",
] as const;
const SLUG_BY_ID: Record<string, string> = Object.fromEntries(
  DEMO_SLUGS.map((s) => [campaignIdFromSlug(s), s]),
);

/** URL slug for a campaign: its known demo slug, else the raw campaignId (both resolvable). */
export function slugFor(campaign: CampaignResponse): string {
  return SLUG_BY_ID[campaign.campaignId.toLowerCase()] ?? campaign.campaignId;
}

/**
 * Resolve a /f/<param> route param to a campaign. `param` may be a slug (→ derive its
 * campaignId) or a raw campaignId; match either. Returns undefined if not found.
 */
export function findCampaignByParam(
  list: CampaignResponse[],
  param: string,
): CampaignResponse | undefined {
  const raw = param.toLowerCase();
  let fromSlug: string | null = null;
  try {
    fromSlug = campaignIdFromSlug(param);
  } catch {
    fromSlug = null;
  }
  return list.find(
    (c) => c.campaignId.toLowerCase() === fromSlug || c.campaignId.toLowerCase() === raw,
  );
}

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
  [FEATURED_ID]: "/campaigns/relief.jpg",
  [campaignIdFromSlug("id-rural-school-supplies")]: "/campaigns/classroom.jpg",
  [campaignIdFromSlug("clinic-medicine-fund")]: "/campaigns/clinic.jpg",
  [campaignIdFromSlug("masjid-waqf")]: "/campaigns/masjid-waqf.jpg",
};

/** Cover image for a campaign: its own `imageUrl` if present, else the demo map, else none. */
export function coverImageFor(campaign: CampaignResponse): string | undefined {
  // `||` not `??`: treat an empty-string imageUrl as "no image" and fall through.
  return campaign.imageUrl || COVER_BY_ID[campaign.campaignId.toLowerCase()];
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

/**
 * Free-text search over the loaded campaigns (name, cause, country, type). Case-insensitive
 * substring match — the dataset is small enough that client-side filtering is instant and
 * needs no backend round-trip. An empty/whitespace query returns the list unchanged.
 */
export function searchCampaigns(
  list: CampaignResponse[],
  query: string,
): CampaignResponse[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) =>
    [c.name, c.cause, c.country, c.type]
      .filter((v): v is string => Boolean(v))
      .some((v) => v.toLowerCase().includes(q)),
  );
}

// Enum-keyed class allowlist (S-4): the free-text `type`/`cause` is NEVER
// interpolated into a className. Unknown values fall back to neutral.
const CAUSE_BADGE: Record<CampaignType, string> = {
  // Solid red fill (not a faint tint) so the disaster tag stays legible over a cover photo,
  // on par with the other causes' filled chips.
  disaster: "bg-destructive text-destructive-foreground",
  education: "bg-accent text-accent-foreground",
  medical: "bg-accent text-accent-foreground",
  poverty: "bg-secondary text-secondary-foreground",
  waqf: "bg-accent text-accent-foreground",
  general: "bg-muted text-muted-foreground",
};

export function causeBadgeClass(type: string): string {
  return (CAUSE_BADGE as Record<string, string>)[type] ?? "bg-muted text-muted-foreground";
}
