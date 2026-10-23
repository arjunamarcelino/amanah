"use client";

import { useQuery } from "@tanstack/react-query";
import { campaignIdFromSlug } from "@amanah/shared";
import { getCampaigns } from "@/lib/api";
import { RELEASE_PRESETS, type DemoSlug } from "@/lib/console/presets";
import { useConsoleSession } from "@/lib/console/session";
import { Button } from "@amanah/ui/button";
import { Badge } from "@amanah/ui/badge";

// The console drives the known demo campaigns (preset slugs). Resolve each slug to its
// on-chain campaignId and match API metadata for the name + releaseType label.
const DEMO_SLUGS = Object.keys(RELEASE_PRESETS) as DemoSlug[];

export function CampaignSelect() {
  const { selectedSlug, setSelectedSlug } = useConsoleSession();
  const { data: campaigns = [], isLoading, isError } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaigns(),
  });

  const byId = new Map(campaigns.map((c) => [c.campaignId.toLowerCase(), c]));
  const options = DEMO_SLUGS.map((slug) => ({
    slug,
    campaign: byId.get(campaignIdFromSlug(slug).toLowerCase()),
  }));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Campaign</span>
      <div className="flex flex-wrap gap-2">
        {options.map(({ slug, campaign }) => (
          <Button
            key={slug}
            variant={selectedSlug === slug ? "default" : "outline"}
            onClick={() => setSelectedSlug(slug)}
            className="rounded-full"
          >
            <span>{campaign?.name ?? slug}</span>
            {campaign && (
              <Badge variant="secondary" className="ml-2">
                {campaign.releaseType}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading campaigns…</p>}
      {isError && <p className="text-sm text-destructive">Could not load campaigns.</p>}
    </div>
  );
}
