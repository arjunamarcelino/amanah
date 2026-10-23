import { cn } from "@amanah/ui/lib/utils";
import type { FundingView } from "@/lib/funding";

// GoFundMe-style funding line: a thin gradient progress bar over a bold "$X raised"
// figure. `raised` is real (confirmed on-chain donations); when a goal exists the bar
// fills to the real percentage and a muted "of $goal" clause follows. With no goal the
// bar renders empty and only the raised figure shows.
//
// `onImage` restyles it for an overlay on a dark cover photo (the featured hero): a
// translucent track and white text instead of the card palette.
export function FundingProgress({
  view,
  onImage = false,
}: {
  view: FundingView;
  onImage?: boolean;
}) {
  const { pct, raisedLabel, goalLabel } = view;
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "h-2 w-full overflow-hidden rounded-full",
          onImage ? "bg-white/25" : "bg-muted",
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct ?? 0)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={goalLabel ? `${raisedLabel} raised of ${goalLabel} goal` : `${raisedLabel} raised`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(144_48%_42%)] transition-[width] duration-500"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <p className={cn("text-sm", onImage ? "text-white/85" : "text-foreground-soft")}>
        <span className={cn("font-semibold", onImage ? "text-white" : "text-foreground")}>
          {raisedLabel}
        </span>{" "}
        raised
        {goalLabel ? <span> · of {goalLabel}</span> : null}
      </p>
    </div>
  );
}
