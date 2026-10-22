import type { ReactNode } from "react";
import { cn } from "@amanah/ui/lib/utils";

/**
 * Section landmark + content container (the sole layout primitive).
 *
 * Frozen contract — Phase-1 section workstreams rely on this shape:
 *   id?         anchor id for the <section>
 *   labelledBy? id of the heading that names the section (aria-labelledby)
 *   className?  extra classes on the inner container
 *   children
 */
export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className="border-b border-border/70 py-[clamp(4.5rem,9vw,8rem)]"
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[69rem] px-[clamp(1.25rem,5vw,3rem)]",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
