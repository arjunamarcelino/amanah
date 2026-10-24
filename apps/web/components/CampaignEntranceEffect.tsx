"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import type { CampaignResponse } from "@amanah/shared";

// Themed, SEMI-TRANSPARENT fullscreen overlay shown when a campaign detail page opens — the
// page stays visible (tinted/blurred) behind it. Dismissed by the "Help" button OR tapping
// anywhere. Shown once per campaign per session (sessionStorage). Reduced-motion renders a
// static tint (no particles/animation) but keeps the dismiss interaction.
type Kind = "smoke" | "water" | "warmLight" | "pulse" | "lantern";

export function effectFor(c: CampaignResponse): Kind {
  const text = `${c.name ?? ""} ${c.cause}`.toLowerCase();
  if (/fire|forest|karhutla|wildfire|haze|asap/.test(text)) return "smoke";
  if (/typhoon|flood|banjir|storm|cyclone|tsunami|rain/.test(text)) return "water";
  switch (c.type) {
    case "education":
      return "warmLight";
    case "medical":
      return "pulse";
    case "waqf":
      return "lantern";
    case "disaster":
      return "smoke"; // generic disaster → haze
    default:
      return "warmLight";
  }
}

const COPY: Record<Kind, { headline: string; button: string; aria: string }> = {
  smoke: { headline: "Haze blankets the region.", button: "Help clear the air", aria: "Smoke overlay" },
  water: { headline: "The floodwaters are rising.", button: "Help clear the water", aria: "Flood overlay" },
  warmLight: { headline: "Keep the classrooms lit.", button: "Help a child learn", aria: "Education overlay" },
  pulse: { headline: "The clinic is running low.", button: "Help keep care going", aria: "Medical overlay" },
  lantern: { headline: "A gift that endures.", button: "Help build the waqf", aria: "Waqf overlay" },
};

// Deterministic (no Math.random → no hydration risk) positions/timings.
const cols = (n: number) => Array.from({ length: n }, (_, i) => i);

export function CampaignEntranceEffect({ campaign }: { campaign: CampaignResponse }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const key = `amanah.fx.seen.${campaign.campaignId.toLowerCase()}`;

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(key)) {
        setVisible(true);
        // next frame → opacity transitions 0 → 1 for a smooth fade-in (not a hard cut).
        requestAnimationFrame(() => setEntered(true));
      }
    } catch {
      /* sessionStorage unavailable → just don't show */
    }
  }, [key]);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setVisible(false), 500);
  }

  if (!visible) return null;
  const kind = effectFor(campaign);
  const copy = COPY[kind];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.aria}
      onClick={dismiss}
      className={cn(
        "fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden transition-opacity duration-700 ease-out",
        leaving || !entered ? "opacity-0" : "opacity-100",
      )}
    >
      <EffectLayers kind={kind} reduce={!!reduce} />

      {/* Center CTA — readable dark pill over any theme. Click bubbles to the overlay = dismiss. */}
      <div className="relative z-10 mx-6 flex flex-col items-center gap-4 rounded-2xl bg-black/35 px-7 py-6 text-center backdrop-blur-sm">
        <p className="font-serif text-2xl leading-tight text-white md:text-3xl">{copy.headline}</p>
        <Button size="lg" className="rounded-full px-6 font-semibold" onClick={dismiss}>
          {copy.button}
        </Button>
        <p className="text-xs text-white/75">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

function EffectLayers({ kind, reduce }: { kind: Kind; reduce: boolean }) {
  const vignette = (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_48%,transparent,rgba(0,0,0,0.4))]" />
  );

  if (kind === "smoke") {
    // Overall soft haze over a blurred page; slow, large, overlapping fog blobs that drift +
    // breathe so they read as one continuous, smooth haze (not discrete puffs).
    return (
      <>
        <div className="absolute inset-0 bg-neutral-500/45 backdrop-blur-xl" />
        {reduce ? (
          <div className="absolute inset-0 bg-neutral-400/25 blur-2xl" />
        ) : (
          [
            { l: "-8%", t: "6%", s: "62vw", d: 26, delay: 0 },
            { l: "48%", t: "-6%", s: "66vw", d: 30, delay: 3 },
            { l: "22%", t: "42%", s: "72vw", d: 24, delay: 1.5 },
            { l: "62%", t: "48%", s: "58vw", d: 28, delay: 4.5 },
            { l: "6%", t: "62%", s: "60vw", d: 32, delay: 2 },
            { l: "72%", t: "12%", s: "52vw", d: 22, delay: 5.5 },
          ].map((b, i) => (
            <div
              key={i}
              className="fx-anim absolute rounded-full bg-neutral-300/25"
              style={{
                left: b.l,
                top: b.t,
                width: b.s,
                height: b.s,
                filter: "blur(80px)",
                animation: `fx-fog ${b.d}s ease-in-out ${b.delay}s infinite`,
              }}
            />
          ))
        )}
        {vignette}
      </>
    );
  }

  if (kind === "water") {
    return (
      <>
        <div className="absolute inset-0 bg-sky-900/35 backdrop-blur-[2px]" />
        {!reduce &&
          cols(16).map((i) => (
            <span
              key={i}
              className="fx-anim absolute top-0 h-24 w-px bg-sky-100/40"
              style={{ left: `${(i * 6.3 + 3) % 100}%`, animation: `fx-rain ${1.6 + (i % 3) * 0.5}s linear ${(i % 5) * 0.35}s infinite` }}
            />
          ))}
        {/* rising water at the bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-700/70 via-sky-700/35 to-transparent" />
        {vignette}
      </>
    );
  }

  if (kind === "pulse") {
    return (
      <>
        <div className="absolute inset-0 bg-emerald-950/30 backdrop-blur-[1px]" />
        {!reduce &&
          cols(3).map((i) => (
            <span
              key={i}
              className="fx-anim absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-200/60"
              style={{ animation: `fx-ring ${3}s ease-out ${i * 1}s infinite` }}
            />
          ))}
        {vignette}
      </>
    );
  }

  // warmLight (education) + lantern (waqf): warm glow + rising embers; lantern is dimmer/amber-deep.
  const warm = kind === "warmLight";
  return (
    <>
      <div className={cn("absolute inset-0", warm ? "bg-amber-300/25" : "bg-amber-950/45 backdrop-blur-[2px]")} />
      <div
        className="absolute inset-0"
        style={{
          background: warm
            ? "radial-gradient(50% 50% at 50% 42%, rgba(251,191,36,0.42), transparent)"
            : "radial-gradient(45% 45% at 50% 40%, rgba(245,158,11,0.45), transparent)",
        }}
      />
      {!reduce &&
        cols(12).map((i) => (
          <span
            key={i}
            className={cn("fx-anim absolute bottom-0 rounded-full", warm ? "size-1.5 bg-amber-200" : "size-1 bg-amber-300/90")}
            style={{ left: `${(i * 8.3 + 5) % 100}%`, animation: `fx-rise ${3 + (i % 4)}s ease-in ${(i % 6) * 0.5}s infinite` }}
          />
        ))}
      {vignette}
    </>
  );
}
