"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RailResponse } from "@amanah/shared";
import type { RailCardState } from "./routerTypes";

// Complete, literal Tailwind class strings per state so the JIT compiler sees every
// class at build time. NEVER interpolate rail fields into a className.
const CONTAINER_BY_STATE: Record<RailCardState, string> = {
  idle: "border bg-card",
  thinking: "border bg-card",
  chosen: "border-primary bg-accent ring-2 ring-primary/70",
  dimmed: "border bg-card",
  fallbackChosen: "border-dashed border-foreground-soft bg-secondary",
};

// Opacity/scale are driven by motion (not className) so reduced-motion collapses them
// to an instant snap — the resting visual must be complete with motion off (screenshot).
const MOTION_BY_STATE: Record<RailCardState, { opacity: number; scale: number }> = {
  idle: { opacity: 1, scale: 1 },
  thinking: { opacity: 1, scale: 1 },
  chosen: { opacity: 1, scale: 1.03 },
  dimmed: { opacity: 0.4, scale: 0.97 },
  fallbackChosen: { opacity: 1, scale: 1 },
};

export function RailCard({ rail, state }: { rail: RailResponse; state: RailCardState }) {
  const reduceMotion = useReducedMotion();
  const target = MOTION_BY_STATE[state];

  return (
    <motion.div
      animate={{ opacity: target.opacity, scale: target.scale }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
      className={`flex min-w-0 flex-col gap-3 rounded-xl p-4 text-card-foreground shadow-sm transition-colors ${CONTAINER_BY_STATE[state]}`}
    >
      <h3 className="font-serif text-base leading-tight text-foreground [overflow-wrap:anywhere]">
        {rail.name}
      </h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Fee</dt>
          <dd className="tabular-nums font-medium text-foreground">{`${(rail.feeBps / 100).toFixed(2)}%`}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">ETA</dt>
          <dd className="tabular-nums text-foreground-soft">{`~${rail.etaMinutes}m`}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Liquidity</dt>
          <dd className="capitalize text-foreground-soft">{rail.liquidity}</dd>
        </div>
      </dl>
    </motion.div>
  );
}
