"use client";

import { Button } from "@amanah/ui/button";
import type { CampaignType } from "@amanah/shared";
import type { CauseChip } from "@/lib/campaigns";

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
      {chips.map((c) => (
        <Button
          key={c}
          size="sm"
          variant={c === active ? "default" : "outline"}
          onClick={() => onSelect(c)}
          className="capitalize"
        >
          {c}
        </Button>
      ))}
    </div>
  );
}
