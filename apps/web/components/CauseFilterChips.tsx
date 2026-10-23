"use client";

import { CauseIcon } from "@amanah/ui/cause-icon";
import { cn } from "@amanah/ui/lib/utils";
import type { CampaignType } from "@amanah/shared";
import type { CauseChip } from "@/lib/campaigns";

// GoFundMe-style category pill row. "All" plus the causes actually present in the dataset.
export function CauseFilterChips({
  causes,
  active,
  onSelect,
}: {
  causes: CampaignType[];
  active: CauseChip;
  onSelect: (c: CauseChip) => void;
}) {
  const chips: CauseChip[] = ["all", ...causes];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const selected = c === active;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(c)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {c !== "all" ? <CauseIcon cause={c} className="size-4" /> : null}
            {c}
          </button>
        );
      })}
    </div>
  );
}
