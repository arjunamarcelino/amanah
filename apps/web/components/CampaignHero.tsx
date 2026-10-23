import Image from "next/image";
import Link from "next/link";
import { Badge } from "@amanah/ui/badge";
import { Button } from "@amanah/ui/button";
import type { CampaignResponse } from "@amanah/shared";
import { coverImageFor } from "@/lib/campaigns";
import { fundingView } from "@/lib/funding";
import { FundingProgress } from "@/components/FundingProgress";

// Featured campaign banner at the top of Discover. A wide cover with an overlaid content
// panel — the whole card links to the donate flow (the button is a visual affordance inside
// the same anchor, not a nested link).
export function CampaignHero({ campaign }: { campaign: CampaignResponse }) {
  const { campaignId, cause, name, country, releaseType, baseRaised, goalBase } = campaign;
  const cover = coverImageFor(campaign);
  const funding = fundingView(baseRaised, goalBase);
  return (
    <Link
      href={`/donate/${campaignId}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[21/10] w-full bg-muted md:aspect-[21/8]">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
        {/* Legibility scrim behind the text. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 md:max-w-2xl md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="w-fit bg-background/90 text-foreground">Featured</Badge>
            {country ? (
              <span className="text-sm font-medium text-white/90">{country}</span>
            ) : null}
            <Badge variant="outline" className="border-white/40 capitalize text-white/90">
              {releaseType.toLowerCase()}
            </Badge>
          </div>
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-white md:text-4xl">
            {name ?? cause}
          </h2>
          <p className="max-w-xl text-sm text-white/85 md:text-base">{cause}</p>
          <div className="mt-1 max-w-md">
            <FundingProgress view={funding} onImage />
          </div>
          <Button className="mt-1 w-fit rounded-full px-6 font-semibold">Donate now</Button>
        </div>
      </div>
    </Link>
  );
}
