"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@amanah/ui/button";
import { getCampaigns } from "@/lib/api";
import {
  visibleCampaigns,
  availableCauses,
  filterByCause,
  isFeatured,
  type CauseChip,
} from "@/lib/campaigns";
import { CampaignCard } from "@/components/CampaignCard";
import { CampaignHero } from "@/components/CampaignHero";
import { CauseFilterChips } from "@/components/CauseFilterChips";
import { SameEngineShowcase } from "@/components/SameEngineShowcase";

export default function BrowsePage() {
  const [cause, setCause] = useState<CauseChip>("all");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaigns(),
  });

  const all = useMemo(() => visibleCampaigns(data ?? []), [data]);
  const featured = useMemo(() => all.find(isFeatured), [all]);
  const causes = useMemo(() => availableCauses(all), [all]);
  const filtered = useMemo(() => filterByCause(all, cause), [all, cause]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl">Amanah</h1>
        <p className="text-foreground-soft">
          Give to a cause on Base Sepolia — gasless, any stablecoin, transparent end to end.
        </p>
      </header>

      {isLoading ? <SkeletonGrid /> : null}

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-6">
          <p className="text-sm text-foreground-soft">Couldn&apos;t load campaigns.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        all.length === 0 ? (
          <p className="text-foreground-soft">No active campaigns yet.</p>
        ) : (
          <>
            {featured ? <CampaignHero campaign={featured} /> : null}
            <CauseFilterChips causes={causes} active={cause} onSelect={setCause} />
            {filtered.length === 0 ? (
              <p className="text-foreground-soft">No campaigns for this cause.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <CampaignCard key={c.campaignId} campaign={c} />
                ))}
              </div>
            )}
          </>
        )
      ) : null}

      <SameEngineShowcase />
    </main>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
