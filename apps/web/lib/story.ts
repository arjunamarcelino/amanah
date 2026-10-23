import type { CampaignResponse } from "@amanah/shared";
import { DEMO_BY_ID } from "./demo-campaigns";

// Story paragraphs for the detail page (GoFundMe's main body). The API has no `story` field,
// so demo campaigns carry theirs in DEMO_BY_ID (colocated with slug/cover); anything else gets
// a fallback generated from the campaign metadata. Narrative/demo content — not on-chain data.
export function storyFor(campaign: CampaignResponse): string[] {
  const known = DEMO_BY_ID[campaign.campaignId.toLowerCase()];
  if (known) return known.story;
  const where = campaign.country ? ` in ${campaign.country}` : "";
  const org = campaign.recipientOrg ? ` Funds are delivered through ${campaign.recipientOrg}.` : "";
  return [
    `${campaign.name ?? campaign.cause}${where}. ${campaign.cause}.`,
    `This campaign is powered by Amanah's release engine — ${campaign.releaseType.toLowerCase()} release, AI off-ramp routing, and idle-yield on pooled funds.${org}`,
    "Every movement of funds is a public event on Base, so you can verify exactly where your gift goes — from your donation to delivery.",
  ];
}
