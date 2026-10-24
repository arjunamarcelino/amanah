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
  // \b-anchored so we match whole words, not substrings: "reforestation" must not trip
  // \bforest\b, "campfire" must not trip \bfire\b, "brainstorm" must not trip \bstorm\b.
  if (/\b(?:fire|forest|karhutla|wildfire|haze|asap)\b/.test(text)) return "smoke";
  if (/\b(?:typhoon|flood|banjir|storm|cyclone|tsunami|rain)\b/.test(text)) return "water";
  switch (c.type) {
    case "education":
    case "poverty":
    case "general":
      return "warmLight";
    case "medical":
      return "pulse";
    case "waqf":
      return "lantern";
    case "disaster":
      return "smoke"; // generic disaster → haze
    default: {
      // Exhaustiveness guard: every CampaignType is handled above, so c.type is `never`
      // here. Adding a new CampaignType turns this into a compile error (not a silent
      // fallthrough to warmLight), while the return keeps a safe runtime default.
      const _exhaustive: never = c.type;
      return "warmLight";
    }
  }
}

const COPY: Record<Kind, { headline: string; button: string; aria: string }> = {
  smoke: { headline: "Haze blankets the region.", button: "Help the people affected", aria: "Smoke overlay" },
  water: { headline: "The floodwaters are rising.", button: "Help the people affected", aria: "Flood overlay" },
  warmLight: { headline: "Keep the classrooms lit.", button: "Help a child learn", aria: "Education overlay" },
  pulse: { headline: "The clinic is running low.", button: "Help patients in need", aria: "Medical overlay" },
  lantern: { headline: "A gift that endures.", button: "Support the community", aria: "Waqf overlay" },
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
        "fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden transition-opacity ease-out",
        // Entrance: 1.2s fade-in. Exit: a quick 500ms fade that MATCHES the unmount timeout, and
        // pointer-events-none so the fading overlay stops eating clicks meant for the page.
        leaving
          ? "pointer-events-none opacity-0 duration-500"
          : entered
            ? "opacity-100 duration-[1200ms]"
            : "opacity-0 duration-[1200ms]",
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
    // Realistic haze: a soft blurred base + an SVG feTurbulence smoke texture slowly drifting
    // (static filter, CSS-driven motion → smooth and cheap). The page stays visible behind.
    return (
      <>
        {/* backdrop-blur-sm (not -lg): a smaller blur radius is far cheaper to recompute while
            the overlay opacity animates — the feTurbulence texture carries the haze look. */}
        <div className="absolute inset-0 bg-neutral-500/40 backdrop-blur-sm" />
        {reduce ? (
          <div className="absolute inset-0 bg-neutral-400/30 blur-2xl" />
        ) : (
          <svg
            className="fx-smoke absolute inset-[-12%] h-[124%] w-[124%]"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            {/* numOctaves 3 (near-identical for drifting haze) + a smaller filter region keep
                the one-time feTurbulence rasterization cheap, esp. at high mobile DPR. */}
            <filter id="fx-smoke-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.018"
                numOctaves="3"
                seed="7"
                stitchTiles="stitch"
              />
              {/* Map the noise to a translucent gray smoke: constant gray RGB, alpha from noise. */}
              <feColorMatrix type="matrix" values="0 0 0 0 0.72 0 0 0 0 0.72 0 0 0 0 0.72 0 0 0 1.1 -0.35" />
            </filter>
            <rect width="100%" height="100%" filter="url(#fx-smoke-filter)" />
          </svg>
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
