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
};

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
