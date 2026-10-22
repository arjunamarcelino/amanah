"use client";

import { Label } from "@amanah/ui/label";
import { STABLECOINS, type StablecoinKey } from "@/lib/tokens";

export function StablecoinSelect({
  value,
  onChange,
  id = "stablecoin",
  disabled,
}: {
  value: StablecoinKey;
  onChange: (k: StablecoinKey) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Stablecoin</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as StablecoinKey)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {STABLECOINS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
