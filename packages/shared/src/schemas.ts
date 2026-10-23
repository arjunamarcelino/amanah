import { z } from "zod";
import {
  AddressSchema,
  Bytes32Schema,
  TxHashSchema,
  DecimalStringSchema,
} from "./primitives.js";
import { CampaignType, ReleaseType, DonationStatus, PayoutStatus } from "./enums.js";

// Request schemas are `.strict()` and omit ALL indexer-owned fields (status,
// blockNumber, confirmedAt, registeredOnChain, released/routed txHashes) so a
// client can never mass-assign its way past the confirmed-ratchet. Services
// hard-code status='pending' on every POST path.
//
// NOTE: free-text fields (cause/name/recipientOrg/rationale) are validated for
// shape/length only and stored verbatim. The web app MUST escape them on render —
// combined with the unauthenticated write surface, they are a stored-XSS vector.

// ----------------------------- Campaign --------------------------------------
export const CreateCampaignSchema = z
  .object({
    campaignId: Bytes32Schema,
    type: CampaignType,
    cause: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    country: z.string().min(2).max(64),
    releaseType: ReleaseType,
    recipientOrg: z.string().min(1).max(200),
  })
  .strict();
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

// Response contracts are plain types (not runtime zod) — nothing re-validates a
// response, so only the type is consumed (by the service mappers + the web app).
export type CampaignResponse = {
  campaignId: string;
  type: CampaignType;
  cause: string;
  name: string | null;
  country: string | null;
  releaseType: ReleaseType;
  recipientOrg: string | null;
  active: boolean;
  registeredOnChain: boolean;
  createdAt: string;
  // Real raised total: sum of CONFIRMED on-chain Donated events (DonationLog, status
  // 'confirmed') in base units (Decimal(78,0) string, 6-dp base). Always present; "0"
  // when the campaign has no confirmed donations. NOT authoritative balance — the
  // chain is; this is the cached index summed for display.
  baseRaised: string;
  // Offchain display target (goal) in base units, or null when none is set. A target
  // the campaign declares — not a claim about funds received — so showing it is honest.
  goalBase: string | null;
  // Optional cover image for the campaign (grid card + featured hero). Same-origin
  // path under apps/web/public (e.g. "/campaigns/ph-typhoon-2025.jpg") — CSP img-src
  // is 'self'. Optional so existing responses/mappers need no change; null/undefined
  // → the card falls back to its text-only layout.
  imageUrl?: string | null;
};

// Runtime validator mirroring CampaignResponse. Lenient (.strip — the zod default)
// so an additive field on GET /campaigns never turns a real response into an error.
// The web app validates responses with this because the API write surface is
// unauthenticated: the donor-flow gate reads `active`/`registeredOnChain` off these
// rows, so a malformed row must be rejected rather than silently trusted. (NOTE: this
// still cannot stop a well-formed but malicious row — that requires API auth / an
// on-chain registration check; tracked as a protocol-level risk.)
export const CampaignResponseSchema = z.object({
  campaignId: Bytes32Schema,
  type: CampaignType,
  cause: z.string(),
  name: z.string().nullable(),
  country: z.string().nullable(),
  releaseType: ReleaseType,
  recipientOrg: z.string().nullable(),
  active: z.boolean(),
  registeredOnChain: z.boolean(),
  createdAt: z.string(),
  // Base-units decimal strings (see DecimalStringSchema): raised is always present
  // ("0" when none), goal is nullable.
  baseRaised: DecimalStringSchema,
  goalBase: DecimalStringSchema.nullable(),
  // Same-origin relative path only (leading "/", not "//host", no scheme/whitespace):
  // the value feeds next/image `src`, and next.config has no remotePatterns, so an
  // absolute/remote URL would throw at render. Bounds the documented invariant.
  // regex/max don't change the inferred type (still string), so _CampaignMirror holds.
  imageUrl: z
    .string()
    .regex(/^\/(?!\/)\S*$/)
    .max(512)
    .nullable()
    .optional(),
});

// ------------------------------- Rail ----------------------------------------
export type RailResponse = {
  id: string;
  name: string;
  country: string;
  feeBps: number;
  liquidity: string;
  etaMinutes: number;
  active: boolean;
};

// Runtime validator mirroring RailResponse. Lenient (.strip, the zod default) so an
// additive field on the api's GET /rails response never turns a real response into a
// 502; the POST /route body uses a `.strict()` clone (see RouteRequestSchema) to reject
// unknown keys on client-supplied candidates.
export const RailResponseSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  country: z.string().min(2).max(64),
  feeBps: z.number().int().nonnegative().max(65535), // .int() also rejects NaN/Infinity
  liquidity: z.string().max(64),
  etaMinutes: z.number().int().nonnegative(),
  active: z.boolean(),
});

// Compile-time guard (erased at build): if RailResponseSchema and RailResponse ever
// drift apart in either direction, `_RailMirror` stops compiling.
type _Expect<T extends true> = T;
type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _RailMirror = _Expect<_Equal<z.infer<typeof RailResponseSchema>, RailResponse>>;
type _CampaignMirror = _Expect<_Equal<z.infer<typeof CampaignResponseSchema>, CampaignResponse>>;

// --------------------------- Off-ramp routing --------------------------------
// Why a fallback happened, coarse enough for a caller/agent to decide retry vs escalate:
// "unavailable" (Claude error/timeout → retryable) · "refusal"/"invalid_output" (escalate).
export const FallbackReasonSchema = z.enum(["unavailable", "refusal", "invalid_output"]);
export type FallbackReason = z.infer<typeof FallbackReasonSchema>;

export const RouteRequestSchema = z
  .object({
    amountUsd: z.number().positive().finite().max(1_000_000_000),
    // Length matches the repo country convention; the charset blocks prompt-injection
    // control/markup characters while allowing ISO codes and accented country names.
    // NOT upper-cased — forwarded verbatim to the api's exact-match /rails query.
    country: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[\p{L} .'-]+$/u),
    // Client-supplied candidates are strict (reject unknown keys); 50 is an abuse bound.
    candidates: z.array(RailResponseSchema.strict()).max(50).optional(),
  })
  .strict();
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

// Response contract is a plain type (repo convention — nothing re-validates a response).
export type RouteResponse = {
  chosenRail: string;
  feeBps: number;
  rationale: string;
  fallbackUsed: boolean;
  fallbackReason?: FallbackReason;
};

// Runtime validator mirroring RouteResponse. UNLIKE other responses, this one IS
// re-validated: the web proxy (POST /api/route) and the client parse it before the
// values flow into PayoutRouter.recordAndPay (feeBps → uint16) and onto the public
// ledger (rationale/chosenRail rendered). Bounds mirror the rail/uint16 limits so a
// compromised/buggy agent can't push an oversized string on-chain or into the glass box.
export const RouteResponseSchema = z.object({
  chosenRail: z.string().min(1).max(100),
  feeBps: z.number().int().nonnegative().max(65535),
  rationale: z.string().max(2000),
  fallbackUsed: z.boolean(),
  fallbackReason: FallbackReasonSchema.optional(),
});
type _RouteMirror = _Expect<_Equal<z.infer<typeof RouteResponseSchema>, RouteResponse>>;

// Why a route request was rejected before reaching the model. Shared so the HTTP handler
// and a future MCP tool map the same named reasons to their own transport (status / isError).
export type RouteRejectionReason = "empty" | "duplicate" | "country_mismatch";

// ----------------------------- Donation --------------------------------------
export const CreateDonationSchema = z
  .object({
    txHash: TxHashSchema,
    // Optional: an optimistic client rarely knows the log index. Defaults to 0
    // in the service; the indexer confirms on the real (txHash,logIndex).
    logIndex: z.number().int().nonnegative().optional(),
    donor: AddressSchema,
    campaignId: Bytes32Schema,
    stablecoin: AddressSchema,
    amountIn: DecimalStringSchema,
    baseOut: DecimalStringSchema,
    consentHash: Bytes32Schema,
  })
  .strict();
export type CreateDonation = z.infer<typeof CreateDonationSchema>;

// consentHash is intentionally ABSENT — never returned by the API.
export type DonationResponse = {
  txHash: string;
  logIndex: number;
  blockNumber: string | null;
  donor: string;
  campaignId: string;
  stablecoin: string;
  amountIn: string;
  baseOut: string;
  status: DonationStatus;
  createdAt: string;
  confirmedAt: string | null;
};

// ------------------------------ Payout ---------------------------------------
export const CreatePayoutSchema = z
  .object({
    payoutId: Bytes32Schema,
    campaignId: Bytes32Schema,
    beneficiary: AddressSchema,
    usdcAmount: DecimalStringSchema,
    rail: z.string().min(1).max(100).optional(),
    feeBpsCovered: z.number().int().nonnegative().max(65535).optional(),
    rationale: z.string().max(2000).optional(),
    fallbackUsed: z.boolean().optional(),
  })
  .strict();
export type CreatePayout = z.infer<typeof CreatePayoutSchema>;

export type PayoutResponse = {
  payoutId: string;
  campaignId: string;
  beneficiary: string;
  usdcAmount: string;
  rail: string | null;
  feeBpsCovered: number | null;
  rationale: string | null;
  fallbackUsed: boolean | null;
  status: PayoutStatus;
  unlockTime: string | null;
  releasedTxHash: string | null;
  routedTxHash: string | null;
  createdAt: string;
};

// ------------------------------ Ledger ---------------------------------------
export type LedgerEntry = {
  kind: "donation" | "payout" | "lifecycle";
  eventName: string;
  blockNumber: string | null;
  logIndex: number | null;
  txHash: string | null;
  campaignId: string | null;
  campaignName: string | null;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
