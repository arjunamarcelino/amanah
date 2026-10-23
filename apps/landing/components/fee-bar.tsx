"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@amanah/ui/lib/utils";
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

type TipAlign = "center" | "left" | "right";

// Visual tooltip bubble. Lives in a transparent overlay above the bars (not inside the clipped
// track) so it can spill above the bar. `align` keeps edge tooltips from overflowing the figure.
// It's purely decorative (aria-hidden) — the accessible text is on the Zone's aria-label — and
// shows on both hover and keyboard/touch focus of its Zone.
function Tip({ title, body, align = "center" }: { title: string; body: string; align?: TipAlign }) {
  const pos =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[15rem] rounded-lg bg-foreground px-3 py-2 text-left text-xs leading-snug text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/seg:opacity-100 group-focus/seg:opacity-100",
        pos,
      )}
    >
      <strong className="mb-0.5 block font-semibold text-background">{title}</strong>
      <span className="text-background/80">{body}</span>
    </span>
  );
}

// A focusable zone sized to a bar segment. Carries the segment's full description as an
// aria-label (so keyboard/touch/AT users get it), reveals the visual Tip on hover or focus, and
// shows a focus ring. type=button with no handler — it exists only to expose the description.
function Zone({ width, title, align, children }: { width: string; title: string; align?: TipAlign; children: string }) {
  return (
    <button
      type="button"
      aria-label={`${title}: ${children}`}
      className="group/seg relative h-full shrink-0 cursor-default rounded-sm bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      style={{ width }}
    >
      <Tip title={title} body={children} align={align} />
    </button>
  );
}

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
 * at near-zero fees and a modest vault-yield segment carries it just past. Each segment has a
 * hover tooltip explaining what it is (base donation / fees / yield / the amount you gave).
 *
 * Motion is additive and compositor-only; the FINAL filled state is the default, so with JS
 * off, no IntersectionObserver, or prefers-reduced-motion the bars render full and correct. The
 * animated bars are decorative (aria-hidden); the sr-only figcaption is the text equivalent and
 * the tooltips are a hover-only visual enhancement.
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

          <div className="relative h-11">
            {/* visual bar (clipped + rounded) */}
            <div aria-hidden="true" className="absolute inset-0 flex overflow-hidden rounded-md bg-muted">
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
            {/* hover zones (transparent, carry the tooltips) */}
            <div className="relative flex h-full">
              <Zone width={pct(95)} title="Reaches the cause">
                About 92–97% of your donation actually arrives.
              </Zone>
              <Zone width={pct(5)} title="Lost to fees" align="right">
                3–8% skimmed by platform, payment and last-mile costs before it arrives.
              </Zone>
              <MarkerZone />
            </div>
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

          <div className="relative h-11">
            {/* visual bar (clipped + rounded) */}
            <div aria-hidden="true" className="absolute inset-0 flex overflow-hidden rounded-md bg-muted">
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
            {/* hover zones (transparent, carry the tooltips) */}
            <div className="relative flex h-full">
              <Zone width={pct(100)} title="Your donation">
                Routed on-chain the cheapest way — near-zero fees, so ~100% reaches the cause.
              </Zone>
              <Zone width={pct(8)} title="Vault yield" align="right">
                Idle funds earn in a halal, riba-free vault — adding a little on top of what you
                gave.
              </Zone>
              <MarkerZone />
            </div>
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

// A narrow hover target centred on the dashed "amount you gave" line.
function MarkerZone() {
  const body =
    "100% of your donation. Traditional aid stops short of this line; Amanah passes it with yield.";
  return (
    <button
      type="button"
      aria-label={`Amount you gave: ${body}`}
      className="group/seg absolute inset-y-0 w-4 -translate-x-1/2 cursor-default bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: RAISED_MARK }}
    >
      <Tip title="Amount you gave" body={body} align="right" />
    </button>
  );
}
