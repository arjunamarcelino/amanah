"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@amanah/ui/badge";
import type { RailResponse, RouteResponse } from "@amanah/shared";
import { RailCard } from "./RailCard";

type Phase = "idle" | "thinking" | "decided" | "fallback";
type RailCardState = "idle" | "thinking" | "chosen" | "dimmed" | "fallbackChosen";

function matchesChosen(rail: RailResponse, chosen: RouteResponse | undefined): boolean {
  if (!chosen) return false;
  return rail.name === chosen.chosenRail || rail.id === chosen.chosenRail;
}

function cardStateFor(
  rail: RailResponse,
  phase: Phase,
  chosen: RouteResponse | undefined,
): RailCardState {
  switch (phase) {
    case "idle":
      return "idle";
    case "thinking":
      return "thinking";
    case "decided":
      return matchesChosen(rail, chosen) ? "chosen" : "dimmed";
    case "fallback":
      return matchesChosen(rail, chosen) ? "fallbackChosen" : "dimmed";
  }
}

export function RouterAnimation({
  candidates,
  phase,
  chosen,
  accruedCoversFee,
}: {
  candidates: RailResponse[];
  phase: Phase;
  chosen?: RouteResponse;
  accruedCoversFee?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.28;
  const feeLine = accruedCoversFee
    ? "Fee covered by yield → recipient receives "
    : "Fee covered (platform) → recipient receives ";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI payout router
        </p>
        <h2 className="font-serif text-2xl text-foreground md:text-3xl">
          Choosing the fastest, cheapest way to reach the recipient
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {candidates.map((rail) => (
          <RailCard key={rail.id} rail={rail} state={cardStateFor(rail, phase, chosen)} />
        ))}
      </div>

      {phase === "thinking" ? (
        <div className="flex items-center gap-3 text-sm text-foreground-soft">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <p>Claude is weighing fees, settlement time, and recipient reach…</p>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {phase === "decided" && chosen ? (
          <motion.div
            key="decided"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration, ease: "easeOut" }}
            className="flex flex-col gap-3"
          >
            <p className="max-w-prose font-serif text-lg italic text-foreground">
              {chosen.rationale}
            </p>
            <p className="text-sm text-foreground-soft">
              {feeLine}
              <span className="font-semibold tabular-nums text-primary">~100%</span>
            </p>
          </motion.div>
        ) : null}

        {phase === "fallback" ? (
          <motion.div
            key="fallback"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration, ease: "easeOut" }}
            className="flex flex-col gap-3"
          >
            <Badge variant="secondary" className="w-fit">
              Auto · lowest fee (agent offline)
            </Badge>
            <p className="text-sm text-muted-foreground">
              Agent unavailable — defaulted to the lowest-fee rail.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
