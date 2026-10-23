import type { Metadata } from "next";
import { getCampaigns } from "@/lib/api";
import { findCampaignByParam } from "@/lib/campaigns";
import { CampaignDetail } from "@/components/CampaignDetail";

// Fundraiser detail page (/f/<slug>). Server component so the route can set a per-campaign
// <title>; the interactive page is the client CampaignDetail. Never statically prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const campaigns = await getCampaigns();
    const c = findCampaignByParam(campaigns, slug);
    const name = c?.name ?? c?.cause;
    return { title: name ? `${name} | Amanah` : "Campaign | Amanah" };
  } catch {
    return { title: "Campaign | Amanah" };
  }
}

export default async function FundraiserPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CampaignDetail param={slug} />;
}
