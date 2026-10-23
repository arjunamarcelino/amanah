import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@amanah/ui/lib/utils";

/**
 * Section kicker — a short pine hairline rule + an uppercase pine label. One shared
 * component so the eyebrow looks identical across every section (width, case, tracking,
 * colour) instead of drifting per section.
 *
 * Forwards arbitrary props (`...rest`) to its root so it participates in the [data-reveal]
 * contract when used as a <Stagger> child (otherwise the reveal attributes never reach a DOM
 * node and the kicker stays statically visible while its siblings animate).
 */
export function Eyebrow({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...rest}>
      <span aria-hidden="true" className="h-px w-6 bg-primary" />
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {children}
      </span>
    </div>
  );
}
