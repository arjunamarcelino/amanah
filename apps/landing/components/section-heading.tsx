import type { ReactNode } from "react";
import { cn } from "@amanah/ui/lib/utils";

/**
 * The standard section `<h2>` type scale (fluid clamp, medium weight, tight tracking, balanced).
 * Shared so the six content sections can't drift; callers pass only the per-section deltas
 * (`mt-*`, `max-w-*`) and the heading id via `className` / `id`.
 */
export function SectionHeading({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "text-[clamp(1.9rem,1.2rem+2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.015em] text-balance",
        className,
      )}
    >
      {children}
    </h2>
  );
}
