import type { RailResponse } from "@amanah/shared";

// Single source of truth for "which offered candidate does the agent's chosenRail refer
// to". Used by both the animation (which card lights up) and the route action (which rail
// is re-derived and recorded on-chain) so the highlighted rail and the paid rail can never
// disagree.

/** A candidate matches the agent's choice by name or id. */
export function matchesChosen(rail: RailResponse, chosenRail: string): boolean {
  return rail.name === chosenRail || rail.id === chosenRail;
}

/** The offered candidate the agent chose, or undefined if none matches. */
export function findChosenRail(
  rails: RailResponse[],
  chosenRail: string,
): RailResponse | undefined {
  return rails.find((r) => matchesChosen(r, chosenRail));
}

/** Lowest-fee candidate (active first), stable tie-break by id. */
export function lowestFeeRail(rails: RailResponse[]): RailResponse | undefined {
  const active = rails.filter((r) => r.active);
  const pool = active.length ? active : rails;
  return [...pool].sort((a, b) => a.feeBps - b.feeBps || a.id.localeCompare(b.id))[0];
}
