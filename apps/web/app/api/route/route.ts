import { NextResponse } from "next/server";
import { RouteRequestSchema, RouteResponseSchema, type RailResponse, type RouteResponse } from "@amanah/shared";

// Server-only proxy: holds AGENT_SHARED_SECRET (never shipped to the client — route.ts is
// never bundled for the browser) and forwards POST /route to the Bearer-gated agent. POST
// is never statically cached; runtime is Node so we can read a process-level secret and
// reach the internal agent host.
export const runtime = "nodejs";

const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 16_384;

// Per-IP fixed-window limiter. In-memory → resets on restart and is per-instance, which is
// adequate for a single-VPS demo; a multi-instance deploy would need Redis/Upstash. It caps
// the cost/DoS blast radius of this unauthenticated endpoint (each accepted POST triggers a
// paid Claude call).
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string, now: number): boolean {
  if (hits.size > 10_000) hits.clear(); // crude unbounded-growth guard
  const entry = hits.get(ip);
  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// Deterministic lowest-fee pick from the request's OWN candidates — stable tie-break on id
// so the same input always yields the same rail. Mirrors the agent's response shape with
// fallbackUsed:true so the client animation completes and is honestly labeled.
function lowestFeeFallback(candidates: RailResponse[]): RouteResponse | null {
  const active = candidates.filter((c) => c.active);
  const pool = active.length ? active : candidates;
  if (pool.length === 0) return null;
  const chosen = [...pool].sort((a, b) => a.feeBps - b.feeBps || a.id.localeCompare(b.id))[0];
  return {
    chosenRail: chosen.name,
    feeBps: chosen.feeBps,
    rationale: "Agent unavailable — routed to the lowest-fee rail.",
    fallbackUsed: true,
    fallbackReason: "unavailable",
  };
}

function fallbackOr502(candidates: RailResponse[]) {
  const fb = lowestFeeFallback(candidates);
  return fb
    ? NextResponse.json(fb, { status: 200 })
    : NextResponse.json({ error: "Routing unavailable" }, { status: 502 });
}

export async function POST(request: Request) {
  const agentUrl = process.env.AGENT_URL;
  const secret = process.env.AGENT_SHARED_SECRET;
  if (!agentUrl || !secret) {
    console.error("[agent-proxy] missing AGENT_URL / AGENT_SHARED_SECRET");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Abuse guards for an unauthenticated same-origin POST (it triggers a paid LLM call).
  // Trust exactly one proxy hop (Caddy), which APPENDS the real client IP to the right
  // of any client-supplied X-Forwarded-For. Key the limiter on the RIGHTMOST entry — the
  // leftmost is attacker-controllable, so keying on it lets a spoofed header mint unlimited
  // paid LLM calls (denial-of-wallet). The Anthropic console spend cap is the real backstop.
  const xff = request.headers.get("x-forwarded-for");
  const ip = (xff?.split(",").pop() ?? "unknown").trim() || "unknown";
  if (rateLimited(ip, Date.now())) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported Media Type" }, { status: 415 });
  }
  // Require a same-origin Origin header. Browsers always send it on cross/same-origin POST;
  // a non-browser client that omits it to dodge the check is rejected rather than skipped.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RouteRequestSchema.safeParse(raw);
  if (!parsed.success) {
    // Don't echo zod issues to the client.
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const candidates: RailResponse[] = body.candidates ?? [];

  let upstream: Response;
  try {
    upstream = await fetch(`${agentUrl}/route`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[agent-proxy] upstream unreachable/timeout:", err);
    return fallbackOr502(candidates); // transient → labeled fallback
  }

  // 401 means OUR shared secret is wrong — a deploy misconfig. Fail loud, never fall back.
  if (upstream.status === 401) {
    console.error("[agent-proxy] upstream 401 — AGENT_SHARED_SECRET mismatch");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  // Agent 4xx (country_mismatch / empty / duplicate) is a genuine request problem — surface it.
  if (upstream.status >= 400 && upstream.status < 500) {
    return NextResponse.json({ error: "No eligible rail for this request" }, { status: upstream.status });
  }
  if (!upstream.ok) {
    console.error("[agent-proxy] upstream non-2xx:", upstream.status);
    return fallbackOr502(candidates);
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    console.error("[agent-proxy] upstream returned non-JSON");
    return fallbackOr502(candidates);
  }
  // Re-validate before the values flow to recordAndPay / the public ledger.
  const valid = RouteResponseSchema.safeParse(data);
  if (!valid.success) {
    console.error("[agent-proxy] upstream response failed validation");
    return fallbackOr502(candidates);
  }
  return NextResponse.json(valid.data satisfies RouteResponse, { status: 200 });
}
