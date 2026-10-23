import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import type { CampaignResponse } from "@amanah/shared";
import { coverImageFor } from "@/lib/campaigns";

export function CampaignHero({ campaign }: { campaign: CampaignResponse }) {
  const { campaignId, cause, name, country, releaseType } = campaign;
  const cover = coverImageFor(campaign);
  return (
    <Link href={`/donate/${campaignId}`} className="block focus:outline-none">
      <Card className="overflow-hidden border-primary/30 transition-colors hover:border-primary/60">
        {cover ? (
          // Wide 21:9 hero cover — a larger same-origin image reads best here.
          <div className="relative aspect-[21/9] w-full bg-muted">
            <Image
              src={cover}
              alt={name ?? cause}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardHeader>
          <Badge className="w-fit">Featured</Badge>
          <CardTitle className="text-2xl md:text-3xl">{name ?? cause}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="max-w-2xl text-foreground-soft">{cause}</p>
          <div className="flex items-center gap-2 text-sm text-foreground-soft">
            {country ? <span>{country}</span> : null}
            <Badge variant="outline" className="capitalize">
              {releaseType.toLowerCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
