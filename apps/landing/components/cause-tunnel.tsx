"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * CauseTunnel — the "Where your giving goes" section as a scroll-driven 3D corridor. Cause
 * photos fly from deep in the distance toward the viewer as the section scrolls past, laid out
 * on a golden-angle spiral with a little mouse-parallax. Adapted from a wheel-hijacking hero to
 * a well-behaved in-page section: progress comes from useScroll over a tall wrapper with a
 * sticky viewport, so normal page scrolling drives it (no scroll capture).
 *
 * The corridor is decorative (aria-hidden); the sr-only heading + cause list is the accessible
 * equivalent. Mouse parallax is disabled under prefers-reduced-motion.
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

type TunnelCardData = {
  item: { src: string; title: string };
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
};

const TUNNEL_CARDS: TunnelCardData[] = SOURCE.map((item, i) => {
  const goldenAngle = i * 137.5 * (Math.PI / 180);
  return {
    item,
    angleCos: Math.cos(goldenAngle),
    angleSin: Math.sin(goldenAngle),
    radiusFactorX: 0.28 + (i % 3) * 0.08,
    radiusFactorY: 0.26 + (i % 2) * 0.09,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
    index: i,
  };
});

const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };

type Stage = { width: number; height: number; isMobile: boolean };

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, rawX, rawY]);

  return { x, y };
}

function TunnelCard({
  card,
  progress,
  pointer,
  total,
  stage,
}: {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: Stage;
}) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;

  const localProgress = useTransform(progress, [start, end], [0, 1]);
  const farZ = stage.isMobile ? -1200 : -1700;
  const nearZ = stage.isMobile ? 350 : 500;
  const z = useTransform(localProgress, [0, 1], [farZ, nearZ]);
  const opacity = useTransform(localProgress, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(130, Math.min(180, stage.width * 0.38))
    : Math.max(180, Math.min(270, stage.width * 0.18));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 45;

  const transform = useTransform(
    [z, pointer.x, pointer.y],
    ([currZ, px, py]: number[]) => {
      const offsetX = baseX - px * panStrength;
      const offsetY = baseY - py * panStrength;
      return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
    },
  );

  return (
    <motion.div
      style={{ width: cardWidth, transform, opacity, zIndex: card.index + 1 }}
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-[4/5] select-none will-change-transform"
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-muted shadow-2xl shadow-foreground/20 ring-1 ring-foreground/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.item.src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-4">
          <span className="font-mono text-xs uppercase tracking-widest text-white/95 drop-shadow-md">
            {card.item.title}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function CauseTunnel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>({ width: 1440, height: 900, isMobile: false });

  useEffect(() => {
    const update = () =>
      setStage({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Progress 0→1 as the tall wrapper scrolls through the viewport; sticky inner holds the stage.
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 30,
    restDelta: 0.0001,
  });
  const pointer = useCameraParallax(!reduce);

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.8, 1, 1.22]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.12, 0.78, 0.95], [1, 1, 1, 0]);
  const hintOpacity = useTransform(smoothProgress, [0, 0.1], [1, 0]);

  return (
    <section
      id="causes"
      aria-labelledby="causes-title"
      ref={wrapRef}
      className="relative h-[220vh]"
    >
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
        aria-hidden="true"
        className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden bg-background"
        style={{ perspective: stage.isMobile ? "900px" : "1200px" }}
      >
        {/* soft pine glow for depth */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(144_45%_45%/0.10)_0%,transparent_70%)]" />

        {/* Edge fades: the corridor dissolves into the paper at top and bottom, so it blends
            seamlessly out of the Problem section above and into the next section below. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[15] h-40 bg-gradient-to-b from-background via-background/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* depth ring guides */}
        <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-primary/15" />
        <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-border" />

        {/* floating central text — kept minimal */}
        <motion.div
          style={{ scale: titleScale, opacity: titleOpacity }}
          className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Where your giving goes
            </span>
            <span className="h-px w-6 bg-primary" />
          </div>
          <p className="font-serif text-[clamp(2.5rem,1.4rem+4vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.02em] text-foreground">
            Give to any cause.
          </p>
        </motion.div>

        {/* scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground"
        >
          <span>Scroll</span>
          <div className="h-6 w-px bg-gradient-to-b from-primary to-transparent" />
        </motion.div>

        {/* 3D plane */}
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {TUNNEL_CARDS.map((card) => (
            <TunnelCard
              key={card.index}
              card={card}
              progress={smoothProgress}
              pointer={pointer}
              total={TUNNEL_CARDS.length}
              stage={stage}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
