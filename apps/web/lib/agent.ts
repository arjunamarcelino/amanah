import { RouteResponseSchema, type RouteRequest, type RouteResponse } from "@amanah/shared";

// Client for the same-origin proxy (app/api/route). The browser never sees the agent
// URL or the shared secret — those live in the route handler. The response is runtime
// re-validated here too (defence in depth) before it drives recordAndPay / the ledger.
export async function postRoute(body: RouteRequest): Promise<RouteResponse> {
  const res = await fetch("/api/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`route failed (${res.status})`);
  return RouteResponseSchema.parse(await res.json());
}
