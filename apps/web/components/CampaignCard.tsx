import Image from "next/image";
import Link from "next/link";
import { cn } from "@amanah/ui/lib/utils";
import type { ReactNode } from "react";
import { CauseIcon } from "@amanah/ui/cause-icon";
import type { CampaignResponse } from "@amanah/shared";
import { coverImageFor, slugFor } from "@/lib/campaigns";
import { fundingView } from "@/lib/funding";
import { FundingProgress } from "@/components/FundingProgress";
import { CauseTag } from "@/components/CauseTag";

// All free-text fields (type/cause/name/country) render as escaped JSX text. `type`
// drives styling only via the enum-keyed allowlist (causeBadgeClass, inside CauseTag) —
// never interpolated into a className. The React key (set by the caller) is the campaignId.
//
// Layout note: outer is `flex h-full flex-col` (matching the showcase cards). The cover's
// aspect-ratio box resolves its height inside the flex column; a `block` outer collapsed it.
export function CampaignCard({ campaign }: { campaign: CampaignResponse }) {
  const { type, cause, name, country, releaseType, baseRaised, goalBase } = campaign;
  const cover = coverImageFor(campaign);
  const funding = fundingView(baseRaised, goalBase);
  return (
    <Link
      href={`/f/${slugFor(campaign)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-ring hover:shadow-xl hover:shadow-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* 16:9 cover. Drop a same-origin image under apps/web/public/campaigns. */}
      <div className="relative aspect-[16/9] w-full bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt="" // decorative: the title already names the campaign
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <CauseIcon cause={type} className="size-10 opacity-40" />
          </div>
        )}
        {/* Cause tag floats top-left (no hover color change). */}
        <CauseTag type={type} className="absolute left-3 top-3" />
        {/* Location + release type float bottom-left, over the image like the cause tag. */}
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
          {country ? <OverlayBadge>{country}</OverlayBadge> : null}
          <OverlayBadge className="capitalize">{releaseType.toLowerCase()}</OverlayBadge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-serif text-lg leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
            {name ?? cause}
          </h3>
          <p className="line-clamp-2 text-sm text-foreground-soft">{cause}</p>
        </div>
        <div className="mt-auto">
          <FundingProgress view={funding} />
        </div>
      </div>
    </Link>
  );
}

/** Translucent pill for overlaying on a cover photo — readable over any image. */
function OverlayBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-medium text-background backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
