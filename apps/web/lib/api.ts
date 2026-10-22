import {
  CreateDonationSchema,
  CampaignResponseSchema,
  CreatePayoutSchema,
  RailResponseSchema,
  type CreateDonation,
  type CampaignResponse,
  type CreatePayout,
  type RailResponse,
  type LedgerEntry,
} from "@amanah/shared";
import { ENV } from "./env";
import { sleep } from "./sleep";

// Operational-data client for the NestJS API (HTTP; no app->app import). Types
// come from @amanah/shared. Responses are unvalidated plain types by repo
// convention — trust-cast at this single boundary, never spread with `any`.

/** GET /campaigns (optional ?type=). Throws on non-2xx so the caller's query
 * can surface a retryable error state. */
export async function getCampaigns(type?: string): Promise<CampaignResponse[]> {
  if (!ENV.apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const url = new URL(`${ENV.apiUrl}/campaigns`);
  if (type) url.searchParams.set("type", type);
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET /campaigns failed (${res.status})`);
  // Validate the unauthenticated response: reject malformed rows rather than trusting
  // active/registeredOnChain blindly (the donor-flow gate reads them). Throws on a bad
  // shape → the caller's query surfaces a retryable error.
  return CampaignResponseSchema.array().parse(await res.json());
}

/** GET /rails (optional ?country=) — off-ramp candidates, cheapest-first. Validated with
 * the lenient RailResponseSchema (reject malformed rows). Throws on non-2xx so the
 * route-payout flow surfaces a retryable error. */
export async function getRails(country?: string): Promise<RailResponse[]> {
  if (!ENV.apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const url = new URL(`${ENV.apiUrl}/rails`);
  if (country) url.searchParams.set("country", country);
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET /rails failed (${res.status})`);
  return RailResponseSchema.array().parse(await res.json());
}

/** GET /ledger (optional ?limit=) — the cached merged index. LedgerEntry has no runtime
 * validator (repo convention for responses); trust-cast at this single boundary. The web
 * ledger merges this with live chain events, so the chain is the source of truth anyway. */
export async function getLedger(limit?: number): Promise<LedgerEntry[]> {
  if (!ENV.apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const url = new URL(`${ENV.apiUrl}/ledger`);
  if (limit) url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET /ledger failed (${res.status})`);
  return (await res.json()) as LedgerEntry[];
}

export type PostOutcome =
  | { kind: "accepted" } // 202 / 2xx
  | { kind: "duplicate" } // 409 — already recorded (double-submit or indexer won)
  | { kind: "deferred" }; // 5xx / network / 4xx — non-fatal; indexer reconciles

/** @deprecated use PostOutcome */
export type PostDonationOutcome = PostOutcome;

/**
 * POST /donations — optimistic, idempotent on (txHash, logIndex). NEVER throws:
 * the on-chain donation is already truth, so a failed POST is non-fatal (the
 * indexer reconciles). 409 is treated as success. Retries 5xx/network with
 * exponential backoff + jitter.
 */
export async function postDonation(
  payload: CreateDonation,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<PostDonationOutcome> {
  const { retries = 4, baseMs = 400 } = opts;
  const body = JSON.stringify(CreateDonationSchema.parse(payload));
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ENV.apiUrl}/donations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.status === 202 || res.ok) return { kind: "accepted" };
      if (res.status === 409) return { kind: "duplicate" };
      if (res.status >= 400 && res.status < 500) {
        return { kind: "deferred" };
      }
      // 5xx falls through to retry
    } catch {
      // network error falls through to retry
    }
    if (attempt < retries) await sleep(baseMs * 2 ** attempt + Math.random() * 100);
  }
  return { kind: "deferred" };
}

/**
 * POST /payouts — optimistic log of a routed payout, idempotent on payoutId. NEVER throws:
 * the on-chain recordAndPay is already truth, so a failed POST is non-fatal (the indexer
 * reconciles). 409 is treated as success. Mirrors postDonation's retry/backoff. Amounts
 * are base-units decimal strings (CreatePayoutSchema / DecimalStringSchema), NOT formatted.
 */
export async function postPayout(
  payload: CreatePayout,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<PostOutcome> {
  const { retries = 4, baseMs = 400 } = opts;
  const body = JSON.stringify(CreatePayoutSchema.parse(payload));
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ENV.apiUrl}/payouts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.status === 202 || res.ok) return { kind: "accepted" };
      if (res.status === 409) return { kind: "duplicate" };
      if (res.status >= 400 && res.status < 500) return { kind: "deferred" };
      // 5xx falls through to retry
    } catch {
      // network error falls through to retry
    }
    if (attempt < retries) await sleep(baseMs * 2 ** attempt + Math.random() * 100);
  }
  return { kind: "deferred" };
}
