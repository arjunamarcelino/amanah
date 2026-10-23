"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import type { CampaignResponse } from "@amanah/shared";
import { Button } from "@amanah/ui/button";
import { getCampaigns } from "@/lib/api";
import {
  visibleCampaigns,
  availableCauses,
  filterByCause,
  searchCampaigns,
  isFeatured,
  type CauseChip,
} from "@/lib/campaigns";
import { useSearch } from "@/lib/search";
import { CampaignCard } from "@/components/CampaignCard";
import { CampaignHero } from "@/components/CampaignHero";
import { CauseFilterChips } from "@/components/CauseFilterChips";
import { SameEngineShowcase } from "@/components/SameEngineShowcase";

// Discover — the app's base route (GoFundMe-style browse). Two modes driven by the header
// search box: an empty query shows the discover layout (featured hero + category chips +
// grid + the same-engine showcase); a non-empty query collapses to a focused results list.
// Client component (hooks + live search); the route-level <title> is set by the server page.
export function DiscoverView() {
  const [cause, setCause] = useState<CauseChip>("all");
  const { query } = useSearch();
  const searching = query.trim().length > 0;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaigns(),
  });

  const all = useMemo(() => visibleCampaigns(data ?? []), [data]);
  const featured = useMemo(() => all.find(isFeatured), [all]);
  const causes = useMemo(() => availableCauses(all), [all]);

  // Search wins over the cause chips: a query filters the whole set; otherwise the active chip does.
  const results = useMemo(
    () => (searching ? searchCampaigns(all, query) : filterByCause(all, cause)),
    [all, cause, query, searching],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 md:py-12">
      {isLoading ? <SkeletonGrid withHero /> : null}

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-6">
          <p className="text-sm text-foreground-soft">Couldn&apos;t load campaigns.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        all.length === 0 ? (
          <p className="text-foreground-soft">No active campaigns yet.</p>
        ) : searching ? (
          <SearchResults query={query} results={results} />
        ) : (
          <>
            <Intro />
            {featured ? <CampaignHero campaign={featured} /> : null}
            <section className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <h2 className="font-serif text-2xl tracking-tight text-foreground md:text-3xl">
                  Browse by cause
                </h2>
                <CauseFilterChips causes={causes} active={cause} onSelect={setCause} />
              </div>
              {results.length === 0 ? (
                <p className="text-foreground-soft">No campaigns for this cause.</p>
              ) : (
                <CampaignGrid>
                  {results.map((c) => (
                    <CampaignCard key={c.campaignId} campaign={c} />
                  ))}
                </CampaignGrid>
              )}
            </section>
            <SameEngineShowcase />
          </>
        )
      ) : null}
    </main>
  );
}

function Intro() {
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
        Give from the heart. Trust every cent.
      </h1>
      <p className="text-lg leading-relaxed text-foreground-soft">
        Back any cause gaslessly in any stablecoin, then follow your gift all the way to delivery
        — every step transparent and verifiable on-chain, at near-zero fees.
      </p>
      {/* "Live on Base" chain line — same lockup and styling as the landing hero, below the lead. */}
      <p className="flex items-center gap-2 text-sm text-foreground-soft">
        <span>Live on</span>
        <Image
          src="/chains/base-logo.svg"
          alt="Base"
          width={75}
          height={19}
          className="h-[1.1rem] w-auto"
        />
      </p>
    </section>
  );
}

function SearchResults({ query, results }: { query: string; results: CampaignResponse[] }) {
  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-serif text-2xl tracking-tight text-foreground md:text-3xl">
        {results.length} {results.length === 1 ? "result" : "results"} for{" "}
        <span className="text-primary">“{query.trim()}”</span>
      </h1>
      {results.length === 0 ? (
        <p className="text-foreground-soft">
          No campaigns match your search. Try a cause, country, or campaign name.
        </p>
      ) : (
        <CampaignGrid>
          {results.map((c) => (
            <CampaignCard key={c.campaignId} campaign={c} />
          ))}
        </CampaignGrid>
      )}
    </section>
  );
}

function CampaignGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function SkeletonGrid({ withHero = false }: { withHero?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      {withHero ? <div className="aspect-[21/9] w-full animate-pulse rounded-2xl bg-card" /> : null}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
