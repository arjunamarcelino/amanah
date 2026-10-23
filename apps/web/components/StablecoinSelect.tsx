"use client";

import { Label } from "@amanah/ui/label";
import { cn } from "@amanah/ui/lib/utils";
import { STABLECOINS, type StablecoinKey } from "@/lib/tokens";

// Segmented token picker (replaces a native <select>, which can't render the token marks).
// Same contract as before — { value, onChange, id?, disabled? } — so the donate form is
// untouched. Accessible as a radiogroup; the visible Label names it.
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
      <Label id={`${id}-label`}>Stablecoin</Label>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="grid grid-cols-3 gap-2"
      >
        {STABLECOINS.map((s) => {
          const selected = s.key === value;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(s.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-primary bg-primary/5 font-medium text-foreground"
                  : "border-input bg-background text-foreground-soft hover:border-ring",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- mixed svg/png/webp
                  token marks; next/image would need dangerouslyAllowSVG for the svg. */}
              <img src={s.icon} alt="" width={20} height={20} className="size-5 rounded-full" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
