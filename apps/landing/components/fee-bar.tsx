"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useInView } from "@/lib/use-in-view";

// One-off chart shades for this figure only — intentionally outside the shadcn token
// contract (they're data colours, not reusable UI-surface tokens): a de-emphasised sage
// for "traditional delivered", a muted taupe + hatch for the "lost" tail, and a brighter
// pine hatch for Amanah's "yield" extension past the amount raised.
const TRADITIONAL_FILL = "hsl(144 18% 42%)";
const LOST_FILL = "hsl(34 10% 52%)";
const LOST_HATCH = "hsl(34 12% 40%)";
const YIELD_FILL = "hsl(144 40% 44%)";
const YIELD_HATCH = "hsl(144 50% 62%)";
const GROW = "transform 900ms cubic-bezier(0.22,1,0.36,1)";

// The track spans 0–110% of what you gave: 100 = the amount raised (dashed marker), and the
// extra headroom is where Amanah's vault yield carries delivery slightly past it.
const SCALE = 110;
const pct = (v: number) => `${((v / SCALE) * 100).toFixed(3)}%`;
const RAISED_MARK = pct(100);

// The "amount you gave" line, drawn across a bar's track.
function RaisedMark() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 z-10 border-l border-dashed border-foreground/45"
      style={{ left: RAISED_MARK }}
    />
  );
}

/**
 * FeeBar — a scroll-triggered, two-bar comparison of how much of a donation is actually
 * delivered: traditional aid versus Amanah.
 *
 * Honest by construction: both bars share one 0–110% track where 100% is the amount raised
 * (the dashed marker). Traditional aid falls short of that line (3–8% lost); Amanah reaches it
 * at near-zero fees and a modest vault-yield segment carries it just past. Motion is additive
 * and compositor-only (transform / opacity); the FINAL filled state is the default, so with JS
 * off, no IntersectionObserver, or prefers-reduced-motion the bars render full and correct. The
 * bars are decorative (aria-hidden); the labels, figures and captions are the text equivalent.
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
        Of each donation, traditional aid delivers about 92–97% and loses 3–8% to last-mile fees.
        Amanah delivers about 100% at near-zero routing fees, and opt-in vault yield can carry
        delivery modestly above the amount raised.
      </figcaption>

      <div className="flex flex-col gap-8">
        {/* Traditional aid — de-emphasised, falls short of the amount raised */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-foreground-soft">Traditional aid</span>
            <span className="tabular-nums text-sm font-medium text-muted-foreground">
              3–8% lost
            </span>
          </div>
          <div
            aria-hidden="true"
            className="relative flex h-11 w-full overflow-hidden rounded-md bg-muted"
          >
            <div
              className="h-full"
              style={{
                width: pct(95),
                backgroundColor: TRADITIONAL_FILL,
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: GROW,
              }}
            />
            <div
              className="h-full border-y border-r border-border"
              style={{
                width: pct(5),
                backgroundColor: LOST_FILL,
                backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${LOST_HATCH} 4px, ${LOST_HATCH} 5px)`,
                opacity: filled ? 1 : 0,
                transition: "opacity 400ms ease 150ms",
              }}
            />
            <RaisedMark />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">falls short of what you gave</p>
        </div>

        {/* Amanah — the hero bar: reaches the line, then grows past it with yield */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <Image
              src="/amanah-logo.png"
              alt="Amanah"
              width={267}
              height={100}
              className="h-[1.6rem] w-auto"
            />
            <span className="tabular-nums text-sm font-medium text-foreground">
              ~0% lost · + yield
            </span>
          </div>
          <div
            aria-hidden="true"
            className="relative flex h-11 w-full overflow-hidden rounded-md bg-muted"
          >
            <div
              className="h-full bg-primary"
              style={{
                width: pct(100),
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: GROW,
                transitionDelay: "200ms",
              }}
            />
            <div
              className="h-full"
              style={{
                width: pct(8),
                backgroundColor: YIELD_FILL,
                backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 5px, ${YIELD_HATCH} 5px, ${YIELD_HATCH} 6px)`,
                transform: filled ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left",
                transition: GROW,
                transitionDelay: "550ms",
              }}
            />
            <RaisedMark />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            near-zero fees — plus vault yield on top
          </p>
        </div>
      </div>

      <p className="mt-4 text-[0.8125rem] text-muted-foreground">
        Illustrative. Traditional last-mile losses of 3–8% vary by corridor, provider and cause.
        Amanah’s routing fees are near zero; opt-in, riba-free vault yield can carry delivery a
        little past the amount you gave (dashed line) — not by much. Network gas or FX may still
        apply.
      </p>
    </figure>
  );
}
