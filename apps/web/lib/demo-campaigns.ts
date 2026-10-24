import { campaignIdFromSlug } from "@amanah/shared";

// Single source of truth for the seeded demo campaigns' presentation data — slug, cover image,
// and story — kept together so they can't drift (previously three separate maps in campaigns.ts
// + story.ts). Keyed by slug; `campaignId = campaignIdFromSlug(slug)` is the join key used
// everywhere else. The API has no slug/imageUrl/story for these yet, so this is demo-only data;
// non-demo campaigns fall back to the raw id URL / text-only card / generated story.
export type DemoCampaign = { slug: string; cover: string; story: string[] };

const BY_SLUG: Record<string, Omit<DemoCampaign, "slug">> = {
  "ph-typhoon-2025": {
    cover: "/campaigns/relief.jpg",
    story: [
      "When the typhoon made landfall, entire coastal barangays were cut off within hours — roofs torn away, roads flooded, and families sheltering in evacuation centres with little more than the clothes they were wearing.",
      "This fund delivers emergency relief the moment it's needed. Because release is parametric, the on-chain trigger fires the instant the disaster threshold is met — no committee, no delay. Funds move to vetted local responders who distribute food, clean water, tarpaulins, and medical supplies.",
      "Every peso-equivalent is traceable end to end. You can follow your gift from the moment you give to the moment it reaches the ground, each step a public event on Base.",
    ],
  },
  "id-rural-school-supplies": {
    cover: "/campaigns/classroom.jpg",
    story: [
      "In remote villages, a lack of basic supplies keeps children out of the classroom. A notebook, a set of pens, a textbook to share — small things that decide whether a child keeps learning.",
      "This campaign funds school supplies for rural students, released in tranches as enrolment and attendance milestones are verified. Support arrives in step with real progress on the ground.",
      "Idle funds don't sit still: while they wait to be deployed, the pooled principal earns halal yield that flows back to the cause.",
    ],
  },
  "clinic-medicine-fund": {
    cover: "/campaigns/clinic.jpg",
    story: [
      "A community clinic is often the only care for miles. When the medicine shelf runs empty, treatable conditions turn dangerous.",
      "This fund keeps essential medicine stocked, unlocking against delivery and dispensing milestones so every tranche maps to medicine that actually reached a patient.",
      "Transparent by design: the ledger shows each disbursement on-chain, so donors and the clinic share the same source of truth.",
    ],
  },
  "masjid-waqf": {
    cover: "/campaigns/masjid-waqf.jpg",
    story: [
      "A waqf is a perpetual endowment — a gift that keeps giving. This campaign builds a lasting endowment for the masjid and the community it serves.",
      "The principal is preserved and put to work in a halal, riba-free vault; the yield funds ongoing programs while the endowment itself endures.",
      "Every movement of funds is recorded on-chain, so the community can verify the waqf is managed faithfully, in perpetuity.",
    ],
  },
  "id-forest-fire-2026": {
    // Reuse the general relief cover (no dedicated forest-fire asset yet).
    cover: "/campaigns/relief.jpg",
    story: [
      "Forest and peatland fires are sweeping across Indonesia again, blanketing whole regions in toxic haze. Families are fleeing their homes, schools and markets have closed, and clinics are filling with people struggling to breathe.",
      "This fund delivers emergency relief to the residents worst affected — clean water, N95 masks and air filtration, food, and medical care for smoke-related illness. Because release is parametric, the on-chain trigger fires the moment the disaster threshold is met: no committee, no delay, the condition is the authorization.",
      "Funds move to vetted local responders, and every movement is a public event on Base. You can follow your gift from the moment you give to the moment it reaches a family on the ground.",
    ],
  },
};

/** Demo presentation data keyed by lowercased campaignId (the join key used across the app). */
export const DEMO_BY_ID: Record<string, DemoCampaign> = Object.fromEntries(
  Object.entries(BY_SLUG).map(([slug, v]) => [campaignIdFromSlug(slug), { slug, ...v }]),
);
