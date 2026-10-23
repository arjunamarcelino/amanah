"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";

/**
 * CauseTunnel — the "Where your giving goes" section as a scroll-driven 3D corridor. Cause
 * photos fly from deep in the distance toward the viewer as the section scrolls past, laid out
 * on a golden-angle spiral with a little mouse-parallax.
 *
 * Implemented in plain React (no framer-motion): a single rAF loop lerps a smoothed scroll
 * progress + pointer toward their targets and writes transforms straight to the DOM — so
 * scrolling never re-renders React. The loop only runs while the section is on-screen, and
 * under prefers-reduced-motion it skips entirely and paints one static snapshot (no fly-through,
 * no parallax). The corridor is decorative (aria-hidden); the sr-only heading + cause list is
 * the accessible equivalent.
 */

const IMAGES = [
  { src: "/showcase/cyclone-ayeyarwady.jpg", title: "Disaster relief" },
  { src: "/showcase/clinic-medicine.jpg", title: "Medical aid" },
  { src: "/showcase/school-supplies.jpg", title: "Education" },
  { src: "/showcase/masjid-waqf.jpg", title: "Masjid & waqf" },
  { src: "/showcase/mekong-flood.jpg", title: "Flood relief" },
];

// Repeat the set so the corridor stays full as cards stream past.
const SOURCE = [...IMAGES, ...IMAGES];
const CARD_COUNT = SOURCE.length;

// ── Tuning (named so there are no scattered magic numbers in the hot path) ──
const GOLDEN_ANGLE_DEG = 137.5; // spiral angle between successive cards
const STAGGER_SPAN = 0.55; // share of total progress each card's fly-through occupies
const FAR_Z = { mobile: -1200, desktop: -1700 }; // start depth (px)
const NEAR_Z = { mobile: 350, desktop: 500 }; // end depth (px)
const PAN_STRENGTH = { mobile: 20, desktop: 45 }; // mouse-parallax travel (px)
const PROGRESS_SMOOTH = 0.12; // lerp factor for scroll smoothing
const PAN_SMOOTH = 0.1; // lerp factor for pointer smoothing
const STATIC_PROGRESS = 0.5; // snapshot used under reduced motion
const MOBILE_MAX = 768;

type Card = {
  item: { src: string; title: string };
  cos: number;
  sin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  start: number;
  end: number;
};

const CARDS: Card[] = SOURCE.map((item, i) => {
  const angle = i * GOLDEN_ANGLE_DEG * (Math.PI / 180);
  const start = (i / CARD_COUNT) * (1 - STAGGER_SPAN);
  return {
    item,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    radiusFactorX: 0.28 + (i % 3) * 0.08,
    radiusFactorY: 0.26 + (i % 2) * 0.09,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
    start,
    end: start + STAGGER_SPAN,
  };
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Piecewise-linear map (framer useTransform's multi-stop form), stops ascending in [0,1].
function ramp(t: number, stops: number[], values: number[]): number {
  if (t <= stops[0]) return values[0];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i]) {
      const span = stops[i] - stops[i - 1] || 1;
      return lerp(values[i - 1], values[i], (t - stops[i - 1]) / span);
    }
  }
  return values[values.length - 1];
}

type Stage = { width: number; height: number; isMobile: boolean };

export function CauseTunnel() {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stageEl = stageRef.current;
    if (!wrap || !stageEl) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stage: Stage = { width: 1440, height: 900, isMobile: false };
    const measureStage = () => {
      stage.width = window.innerWidth;
      stage.height = window.innerHeight;
      stage.isMobile = window.innerWidth < MOBILE_MAX;
      stageEl.style.perspective = stage.isMobile ? "900px" : "1200px";
    };

    // Smoothed state + its targets (refs-in-closure so the rAF never re-renders React).
    let progress = 0;
    let targetProgress = 0;
    let panX = 0;
    let panY = 0;
    let targetPanX = 0;
    let targetPanY = 0;

    const computeProgress = () => {
      const rect = wrap.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      return travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;
    };

    const apply = (p: number, px: number, py: number) => {
      const farZ = stage.isMobile ? FAR_Z.mobile : FAR_Z.desktop;
      const nearZ = stage.isMobile ? NEAR_Z.mobile : NEAR_Z.desktop;
      const pan = stage.isMobile ? PAN_STRENGTH.mobile : PAN_STRENGTH.desktop;
      const cardWidth = stage.isMobile
        ? Math.max(130, Math.min(180, stage.width * 0.38))
        : Math.max(180, Math.min(270, stage.width * 0.18));

      for (let i = 0; i < CARDS.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const card = CARDS[i];
        const local = clamp((p - card.start) / (card.end - card.start), 0, 1);
        const z = lerp(farZ, nearZ, local);
        const opacity = ramp(local, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);
        const offsetX = card.cos * (stage.width * card.radiusFactorX) - px * pan;
        const offsetY = card.sin * (stage.height * card.radiusFactorY) - py * pan;
        el.style.width = `${cardWidth}px`;
        el.style.opacity = `${opacity}`;
        el.style.transform = `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${z}px) rotateZ(${card.rotationZ}deg)`;
      }

      if (titleRef.current) {
        titleRef.current.style.transform = `scale(${ramp(p, [0, 0.5, 1], [0.8, 1, 1.22])})`;
        titleRef.current.style.opacity = `${ramp(p, [0, 0.12, 0.78, 0.95], [1, 1, 1, 0])}`;
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = `${ramp(p, [0, 0.1], [1, 0])}`;
      }
    };

    measureStage();

    // Reduced motion: one static snapshot, no loop, no listeners.
    if (reduce) {
      apply(STATIC_PROGRESS, 0, 0);
      setReady(true);
      const onResize = () => {
        measureStage();
        apply(STATIC_PROGRESS, 0, 0);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    progress = targetProgress = computeProgress();
    apply(progress, 0, 0);
    setReady(true);

    let raf = 0;
    let running = false;
    const tick = () => {
      progress = lerp(progress, targetProgress, PROGRESS_SMOOTH);
      panX = lerp(panX, targetPanX, PAN_SMOOTH);
      panY = lerp(panY, targetPanY, PAN_SMOOTH);
      apply(progress, panX, panY);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onScroll = () => {
      targetProgress = computeProgress();
    };
    const onPointerMove = (e: PointerEvent) => {
      targetPanX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetPanY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => {
      measureStage();
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);

    // Only animate while the section is on-screen.
    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
        rootMargin: "200px",
      });
      io.observe(wrap);
    } else {
      start();
    }

    return () => {
      stop();
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section id="causes" aria-labelledby="causes-title" ref={wrapRef} className="relative h-[220vh]">
      {/* Accessible, non-visual equivalent of the decorative corridor. */}
      <h2 id="causes-title" className="sr-only">
        Where your giving goes — give to any cause
      </h2>
      <ul className="sr-only">
        {IMAGES.map((c) => (
          <li key={c.title}>{c.title}</li>
        ))}
      </ul>

      <div
        ref={stageRef}
        aria-hidden="true"
        className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden bg-background transition-opacity duration-500"
        style={{ perspective: "1200px", opacity: ready ? 1 : 0 }}
      >
        {/* soft pine glow for depth */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(144_45%_45%/0.10)_0%,transparent_70%)]" />

        {/* Edge fades: the corridor dissolves into the paper at top and bottom. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[15] h-40 bg-gradient-to-b from-background via-background/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* depth ring guides */}
        <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-primary/15" />
        <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-border" />

        {/* floating central text — kept minimal */}
        <div ref={titleRef} className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center will-change-transform">
          <Eyebrow className="justify-center">Where your giving goes</Eyebrow>
          <p className="mt-4 font-serif text-[clamp(2.5rem,1.4rem+4vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.02em] text-foreground">
            Give to any cause.
          </p>
        </div>

        {/* scroll hint */}
        <div
          ref={hintRef}
          className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground"
        >
          <span>Scroll</span>
          <div className="h-6 w-px bg-gradient-to-b from-primary to-transparent" />
        </div>

        {/* 3D plane — preserve-3d sorts the cards by their translateZ depth */}
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {CARDS.map((card, i) => (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-[4/5] w-[200px] select-none opacity-0 will-change-transform"
            >
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-muted shadow-2xl shadow-foreground/20 ring-1 ring-foreground/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-4">
                  <span className="font-mono text-xs uppercase tracking-widest text-white/95 drop-shadow-md">
                    {card.item.title}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
