"use client";

import { useEffect, useRef, useState } from "react";

/**
 * FeeBar — a scroll-triggered, two-bar comparison of how much of a donation is
 * actually delivered: traditional aid versus Amanah.
 *
 * Honest by construction: both bars share a single 0–100% track and the widths
 * encode the real figures (~95% vs ~100% delivered). The motion is additive and
 * compositor-only (transform / opacity). The FINAL filled state is the default,
 * so with JS disabled, no IntersectionObserver, or prefers-reduced-motion the
 * bars render full and correct. The bars are decorative (aria-hidden); the
 * labels, figures and captions are the accessible text equivalent.
 */
export function FeeBar() {
  // armed  -> JS has mounted (so we may hide, then animate)
  // shown  -> scrolled into view (or shown immediately when motion is off)
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window) || !el) {
      setArmed(true);
      setShown(true);
      return;
    }

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // SSR / no-JS: armed=false -> scaleX(1) (full). JS: armed=true, shown=false ->
  // scaleX(0), then grows to scaleX(1) on intersect.
  const filled = !armed || shown;

  return (
    <figure ref={ref} className="m-0">
      <figcaption
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
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
          <div
            aria-hidden="true"
            className="flex h-11 w-full overflow-hidden rounded-md bg-muted"
          >
            <div
              className="h-full"
              style={{
                width: "95%",
                backgroundColor: "hsl(144 18% 42%)",
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 900ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
            <div style={{ width: 2 }} aria-hidden="true" />
            <div
              className="h-full rounded-r-md border border-border"
              style={{
                width: "5%",
                backgroundColor: "hsl(34 10% 52%)",
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent, transparent 4px, hsl(34 12% 40%) 4px, hsl(34 12% 40%) 5px)",
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
          <div
            aria-hidden="true"
            className="flex h-11 w-full overflow-hidden rounded-md bg-muted"
          >
            <div
              className="h-full w-full bg-primary"
              style={{
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 900ms cubic-bezier(0.22,1,0.36,1)",
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
