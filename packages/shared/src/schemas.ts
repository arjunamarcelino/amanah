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
});
export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;

// ------------------------------- Rail ----------------------------------------
export const RailResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  feeBps: z.number().int(),
  liquidity: z.string(),
  etaMinutes: z.number().int(),
  active: z.boolean(),
});
export type RailResponse = z.infer<typeof RailResponseSchema>;

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
export const DonationResponseSchema = z.object({
  txHash: TxHashSchema,
  logIndex: z.number().int(),
  blockNumber: z.string().nullable(),
  donor: AddressSchema,
  campaignId: Bytes32Schema,
  stablecoin: AddressSchema,
  amountIn: DecimalStringSchema,
  baseOut: DecimalStringSchema,
  status: DonationStatus,
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
});
export type DonationResponse = z.infer<typeof DonationResponseSchema>;

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

export const PayoutResponseSchema = z.object({
  payoutId: Bytes32Schema,
  campaignId: Bytes32Schema,
  beneficiary: AddressSchema,
  usdcAmount: DecimalStringSchema,
  rail: z.string().nullable(),
  feeBpsCovered: z.number().int().nullable(),
  rationale: z.string().nullable(),
  fallbackUsed: z.boolean().nullable(),
  status: PayoutStatus,
  unlockTime: z.string().nullable(),
  releasedTxHash: TxHashSchema.nullable(),
  routedTxHash: TxHashSchema.nullable(),
  createdAt: z.string(),
});
export type PayoutResponse = z.infer<typeof PayoutResponseSchema>;

// ------------------------------ Ledger ---------------------------------------
export const LedgerEntrySchema = z.object({
  kind: z.enum(["donation", "payout", "lifecycle"]),
  eventName: z.string(),
  blockNumber: z.string().nullable(),
  logIndex: z.number().int().nullable(),
  txHash: TxHashSchema.nullable(),
  campaignId: Bytes32Schema.nullable(),
  campaignName: z.string().nullable(),
  status: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
