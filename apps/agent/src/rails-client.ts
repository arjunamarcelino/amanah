import { RailResponseSchema, type RailResponse } from "@amanah/shared";
import { RAILS_PATH, MAX_UPSTREAM_RAILS } from "./constants.js";

/** A genuine upstream failure (network / non-2xx / bad shape) — distinct from a Claude
 *  failure, which falls back. Carries the HTTP status the route should surface. */
export class RailsUpstreamError extends Error {
  readonly statusCode = 502;
}

/** Fetch active rails for a country from apps/api. Lenient parse (RailResponseSchema is
 *  `.strip()`) so an additive upstream field never turns a real response into a 502. */
export async function fetchRails(
  apiUrl: string,
  country: string,
  timeoutMs: number,
): Promise<RailResponse[]> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${RAILS_PATH}?country=${encodeURIComponent(country)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // name only — never put the URL (or anything secret-adjacent) in the message
    throw new RailsUpstreamError(`rails fetch failed: ${(cause as Error).name}`);
  }
  if (!res.ok) {
    throw new RailsUpstreamError(`rails fetch returned ${res.status}`);
  }
  const parsed = RailResponseSchema.array().max(MAX_UPSTREAM_RAILS).safeParse(await res.json());
  if (!parsed.success) {
    throw new RailsUpstreamError("rails response shape invalid");
  }
  return parsed.data;
}
