"use client";

import { Children, cloneElement, isValidElement } from "react";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";

/**
 * Staggered scroll-reveal. Wraps a block whose direct children should cascade into view. One
 * IntersectionObserver per Stagger; each child is tagged with the shared [data-reveal]
 * contract (globals.css) plus an incremental `--reveal-delay`, so the cascade is pure CSS and
 * reduced-motion safe. Children render on the server — only this wrapper is a client boundary.
 *
 * Motion language: 70ms between items, capped implicitly by small groups; one ease, no overshoot.
 */
export function Stagger({
  children,
  step = 70,
  start = 0,
  className,
  ...rest
}: {
  children: ReactNode;
  /** ms between consecutive children. */
  step?: number;
  /** ms before the first child. */
  start?: number;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const { ref, inView } = useInView<HTMLDivElement>();
  // Counts only real elements (not the Children.map index, which also counts text/null
  // children), so the delays stay contiguous even if a child is conditionally null.
  let idx = 0;
  return (
    <div ref={ref} className={className} {...rest}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const i = idx++;
        const el = child as ReactElement<Record<string, unknown>>;
        const prevStyle = (el.props.style as CSSProperties | undefined) ?? {};
        return cloneElement(el, {
          "data-reveal": "",
          "data-show": inView ? "" : undefined,
          style: { ...prevStyle, "--reveal-delay": `${start + i * step}ms` } as CSSProperties,
        });
      })}
    </div>
  );
}
