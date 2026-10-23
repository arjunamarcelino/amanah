import { campaignIdFromSlug, type CampaignResponse } from "@amanah/shared";

// Mock campaign stories for the detail page (GoFundMe's main body). The API has no `story`
// field yet, so these are hardcoded per demo campaign, with a generated fallback from the
// campaign metadata for anything else. Narrative/demo content — not on-chain data.
const STORY_BY_ID: Record<string, string[]> = {
  [campaignIdFromSlug("ph-typhoon-2025")]: [
    "When the typhoon made landfall, entire coastal barangays were cut off within hours — roofs torn away, roads flooded, and families sheltering in evacuation centres with little more than the clothes they were wearing.",
    "This fund delivers emergency relief the moment it's needed. Because release is parametric, the on-chain trigger fires the instant the disaster threshold is met — no committee, no delay. Funds move to vetted local responders who distribute food, clean water, tarpaulins, and medical supplies.",
    "Every peso-equivalent is traceable end to end. You can follow your gift from the moment you give to the moment it reaches the ground, each step a public event on Base.",
  ],
  [campaignIdFromSlug("id-rural-school-supplies")]: [
    "In remote villages, a lack of basic supplies keeps children out of the classroom. A notebook, a set of pens, a textbook to share — small things that decide whether a child keeps learning.",
    "This campaign funds school supplies for rural students, released in tranches as enrolment and attendance milestones are verified. Support arrives in step with real progress on the ground.",
    "Idle funds don't sit still: while they wait to be deployed, the pooled principal earns halal yield that flows back to the cause.",
  ],
  [campaignIdFromSlug("clinic-medicine-fund")]: [
    "A community clinic is often the only care for miles. When the medicine shelf runs empty, treatable conditions turn dangerous.",
    "This fund keeps essential medicine stocked, unlocking against delivery and dispensing milestones so every tranche maps to medicine that actually reached a patient.",
    "Transparent by design: the ledger shows each disbursement on-chain, so donors and the clinic share the same source of truth.",
  ],
  [campaignIdFromSlug("masjid-waqf")]: [
    "A waqf is a perpetual endowment — a gift that keeps giving. This campaign builds a lasting endowment for the masjid and the community it serves.",
    "The principal is preserved and put to work in a halal, riba-free vault; the yield funds ongoing programs while the endowment itself endures.",
    "Every movement of funds is recorded on-chain, so the community can verify the waqf is managed faithfully, in perpetuity.",
  ],
};

/** Story paragraphs for a campaign: the demo story if known, else a generated fallback. */
export function storyFor(campaign: CampaignResponse): string[] {
  const known = STORY_BY_ID[campaign.campaignId.toLowerCase()];
  if (known) return known;
  const where = campaign.country ? ` in ${campaign.country}` : "";
  const org = campaign.recipientOrg ? ` Funds are delivered through ${campaign.recipientOrg}.` : "";
  return [
    `${campaign.name ?? campaign.cause}${where}. ${campaign.cause}.`,
    `This campaign is powered by Amanah's release engine — ${campaign.releaseType.toLowerCase()} release, AI off-ramp routing, and idle-yield on pooled funds.${org}`,
    "Every movement of funds is a public event on Base, so you can verify exactly where your gift goes — from your donation to delivery.",
  ];
}
