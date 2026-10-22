import {
  CreateDonationSchema,
  CampaignResponseSchema,
  type CreateDonation,
  type CampaignResponse,
} from "@amanah/shared";
import { ENV } from "./env";

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

export type PostDonationOutcome =
  | { kind: "accepted" } // 202 / 2xx
  | { kind: "duplicate" } // 409 — already recorded (double-submit or indexer won)
  | { kind: "deferred" }; // 5xx / network / 4xx — non-fatal; indexer reconciles

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
