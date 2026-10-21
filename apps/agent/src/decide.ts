import type {
  RouteRequest,
  RouteResponse,
  RailResponse,
  RouteRejectionReason,
} from "@amanah/shared";
import { prepareCandidates } from "./router.js";

export interface DecideDeps {
  fetchRails: (country: string) => Promise<RailResponse[]>;
  route: (input: {
    amountUsd: number;
    country: string;
    candidates: RailResponse[];
  }) => Promise<RouteResponse>;
}

export type DecideResult =
  | { ok: true; result: RouteResponse; candidateCount: number }
  | { ok: false; reason: RouteRejectionReason };

/**
 * Transport-agnostic orchestration of a route request: resolve candidates (caller-supplied
 * or fetched from the api), validate/prepare them, then route. Returns a tagged union that
 * each transport maps to its own protocol (HTTP status / MCP isError). No HTTP types enter
 * here, so a future MCP tool reuses it verbatim.
 *
 * `deps.fetchRails` may throw RailsUpstreamError; that propagates for the caller to map to 502.
 */
export async function decideOffRamp(req: RouteRequest, deps: DecideDeps): Promise<DecideResult> {
  const { amountUsd, country } = req;
  const candidates = req.candidates ?? (await deps.fetchRails(country));
  const prep = prepareCandidates(candidates);
  if (!prep.ok) return { ok: false, reason: prep.reason };
  const result = await deps.route({ amountUsd, country, candidates: prep.candidates });
  return { ok: true, result, candidateCount: prep.candidates.length };
}
