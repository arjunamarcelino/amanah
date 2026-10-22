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
  const { campaignId, type, cause, name, country, releaseType } = campaign;
  return (
    <Link href={`/donate/${campaignId}`} className="block focus:outline-none">
      <Card className="h-full transition-colors hover:border-ring">
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
