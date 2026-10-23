import { cache } from "react";
import type { Metadata } from "next";
import { getCampaigns } from "@/lib/api";
import { findCampaignByParam } from "@/lib/campaigns";
import { CampaignDetail } from "@/components/CampaignDetail";

// Fundraiser detail page (/f/<slug>). Server component so the route can set a per-campaign
// <title>; the interactive page is the client CampaignDetail. Never statically prerendered.
export const dynamic = "force-dynamic";

// Memoize within a single request so generateMetadata + the page share ONE GET /campaigns;
// the result is also handed to the client as initialData so it doesn't refetch on mount.
const loadCampaigns = cache(() => getCampaigns());

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const c = findCampaignByParam(await loadCampaigns(), slug);
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
  const initialCampaigns = await loadCampaigns().catch(() => undefined);
  return <CampaignDetail param={slug} initialCampaigns={initialCampaigns} />;
}
