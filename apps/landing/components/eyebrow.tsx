import type { ReactNode } from "react";
import { cn } from "@amanah/ui/lib/utils";

/**
 * Section kicker — a short pine hairline rule + an uppercase pine label. One shared
 * component so the eyebrow looks identical across every section (width, case, tracking,
 * colour) instead of drifting per section.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden="true" className="h-px w-6 bg-primary" />
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {children}
      </span>
    </div>
  );
}
