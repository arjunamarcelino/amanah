import { CauseIcon } from "@amanah/ui/cause-icon";
import { cn } from "@amanah/ui/lib/utils";
import type { CampaignType } from "@amanah/shared";
import { causeBadgeClass } from "@/lib/campaigns";

// Floating cause chip over a cover photo. Deliberately a plain <span>, NOT the Badge
// component — it's a static label on an image, so it must not change color on hover the
// way Badge's default variant does. Color comes from the enum-keyed causeBadgeClass
// allowlist (the free-text `type` is never interpolated into a className).
export function CauseTag({ type, className }: { type: CampaignType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold capitalize backdrop-blur-sm",
        causeBadgeClass(type),
        className,
      )}
    >
      <CauseIcon cause={type} className="size-3.5" />
      {type}
    </span>
  );
}
