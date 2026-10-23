import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@amanah/ui/card";
import { Badge } from "@amanah/ui/badge";
import { cn } from "@amanah/ui/lib/utils";
import type { CampaignResponse } from "@amanah/shared";
import { causeBadgeClass } from "@/lib/campaigns";

// All free-text fields (type/cause/name/country) render as escaped JSX text. `type`
// drives styling only via the enum-keyed allowlist (causeBadgeClass) — never
// interpolated into a className. The React key (set by the caller) is the campaignId.
export function CampaignCard({ campaign }: { campaign: CampaignResponse }) {
  const { campaignId, type, cause, name, country, releaseType, imageUrl } = campaign;
  return (
    <Link href={`/donate/${campaignId}`} className="block focus:outline-none">
      <Card className="h-full overflow-hidden transition-colors hover:border-ring">
        {imageUrl ? (
          // 16:9 cover. Drop a same-origin image at the imageUrl path (apps/web/public).
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={imageUrl}
              alt={name ?? cause}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Badge className={cn("border-transparent capitalize", causeBadgeClass(type))}>{type}</Badge>
            {country ? <span className="text-xs text-foreground-soft">{country}</span> : null}
          </div>
          <CardTitle className="text-lg">{name ?? cause}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-3">
          <p className="line-clamp-2 text-sm text-foreground-soft">{cause}</p>
          <Badge variant="outline" className="shrink-0 capitalize">
            {releaseType.toLowerCase()}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
