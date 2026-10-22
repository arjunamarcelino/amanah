"use client";

import type { ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";

/**
 * Scroll-reveal wrapper. Frozen contract: { children, className? }.
 *
 * The revealed (final) state is the CSS default (see globals.css), so content is fully
 * legible with JS disabled, with IntersectionObserver unavailable, or under
 * prefers-reduced-motion (a media query keeps `[data-reveal]` visible regardless of
 * `data-show`). Motion is purely additive.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div ref={ref} data-reveal data-show={inView || undefined} className={className}>
      {children}
    </div>
  );
}
