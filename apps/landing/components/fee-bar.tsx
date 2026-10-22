"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/lib/use-in-view";

// One-off chart shades for this figure only — intentionally outside the shadcn token
// contract (they're data colours, not reusable UI-surface tokens): a de-emphasised sage
// for "traditional delivered" and a muted taupe + hatch for the "lost" tail.
const TRADITIONAL_FILL = "hsl(144 18% 42%)";
const LOST_FILL = "hsl(34 10% 52%)";
const LOST_HATCH = "hsl(34 12% 40%)";
const GROW = "transform 900ms cubic-bezier(0.22,1,0.36,1)";

/**
 * FeeBar — a scroll-triggered, two-bar comparison of how much of a donation is actually
 * delivered: traditional aid versus Amanah.
 *
 * Honest by construction: both bars share a single 0–100% track and the widths encode the
 * real figures (~95% vs ~100% delivered). The motion is additive and compositor-only
 * (transform / opacity). The FINAL filled state is the default, so with JS disabled, no
 * IntersectionObserver, or prefers-reduced-motion the bars render full and correct. The
 * bars are decorative (aria-hidden); the labels, figures and captions are the accessible
 * text equivalent.
 */
export function FeeBar() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.3 });
  // `mounted` keeps the first client render matching SSR (bars full) so the page is
  // correct with JS off; once mounted the bars may collapse and grow in on scroll-in.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const filled = !mounted || inView;

  return (
    <figure ref={ref} className="m-0">
      <figcaption className="sr-only">
        Of each donation, traditional aid delivers about 92–97% and loses 3–8% to last-mile
        fees; Amanah delivers about 100%, losing roughly 0% in routing fees.
      </figcaption>

      <div className="flex flex-col gap-8">
        {/* Traditional aid — de-emphasised */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-foreground-soft">Traditional aid</span>
            <span className="tabular-nums text-sm font-medium text-muted-foreground">
              3–8% lost
            </span>
          </div>
          <div aria-hidden="true" className="flex h-11 w-full overflow-hidden rounded-md bg-muted">
            <div
              className="h-full"
              style={{
                width: "95%",
                backgroundColor: TRADITIONAL_FILL,
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: GROW,
              }}
            />
            <div style={{ width: 2 }} aria-hidden="true" />
            <div
              className="h-full rounded-r-md border border-border"
              style={{
                width: "5%",
                backgroundColor: LOST_FILL,
                backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${LOST_HATCH} 4px, ${LOST_HATCH} 5px)`,
                opacity: filled ? 1 : 0,
                transition: "opacity 400ms ease 150ms",
              }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">typically lost at the last mile</p>
        </div>

        {/* Amanah — the hero bar */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">Amanah</span>
            <span className="tabular-nums text-sm font-medium text-foreground">~0% lost</span>
          </div>
          <div aria-hidden="true" className="flex h-11 w-full overflow-hidden rounded-md bg-muted">
            <div
              className="h-full w-full bg-primary"
              style={{
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: GROW,
                transitionDelay: "200ms",
              }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            the AI router finds the cheapest path
          </p>
        </div>
      </div>

      <p className="mt-4 text-[0.8125rem] text-muted-foreground">
        Illustrative. Last-mile losses vary by corridor, provider and cause; 3–8% is a typical
        range, not a quoted rate. “~0%” refers to routing fees — network gas or FX may still
        apply.
      </p>
    </figure>
  );
}
