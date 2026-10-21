// Monotonic write repository for the two-writer money tables.
//
// Prisma's `upsert` runs its `update` branch UNCONDITIONALLY, so a late optimistic
// POST would downgrade a `confirmed` row back to `pending`. The ratchet + the
// write-once payout state machine therefore live here as raw
// `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statements. These are the ONLY
// code paths that write DonationLog / PayoutDecision / Campaign.registeredOnChain,
// and BOTH the API (optimistic) and the indexer (confirmed) call them.
//
// Atomicity: `ON CONFLICT DO UPDATE ... WHERE` is a single statement; Postgres
// row-locks the conflicting tuple until commit, so READ COMMITTED is sufficient —
// no read-then-write race. Callers pass either a PrismaClient or a
// Prisma.TransactionClient (the indexer wraps a whole block-range chunk in one tx).

import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma, PayoutStatus } from "./generated/client";

/** A PrismaClient or an interactive-transaction client — both expose $executeRaw. */
export type Executor = Pick<PrismaClient, "$executeRaw"> | Prisma.TransactionClient;

/**
 * Pure mirror of the SQL `status` CASE. Single source of truth for the derived
 * payout status; the raw statements below compute the same from the fact columns.
 * Rank: pending < released < routed; cancelled is terminal.
 */
export function derivePayoutStatus(facts: {
  releasedTxHash: string | null;
  routedTxHash: string | null;
  cancelledAt: Date | null;
}): PayoutStatus {
  if (facts.cancelledAt !== null) return "cancelled";
  if (facts.routedTxHash !== null) return "routed";
  if (facts.releasedTxHash !== null) return "released";
  return "pending";
}

// ----------------------------- Donations -------------------------------------

export interface PendingDonationInput {
  txHash: string;
  logIndex?: number;
  donor: string;
  campaignId: string;
  stablecoin: string;
  amountIn: string;
  baseOut: string;
  consentHash: string;
}

/** API optimistic write. Never touches a non-pending row (one-way ratchet). */
export function upsertPendingDonation(db: Executor, i: PendingDonationInput): Promise<number> {
  const logIndex = i.logIndex ?? 0;
  return db.$executeRaw`
    INSERT INTO "DonationLog"
      ("id","txHash","logIndex","donor","campaignId","stablecoin","amountIn","baseOut","consentHash","status","createdAt")
    VALUES
      (${randomUUID()}, ${i.txHash}, ${logIndex}, ${i.donor}, ${i.campaignId}, ${i.stablecoin},
       ${i.amountIn}::numeric, ${i.baseOut}::numeric, ${i.consentHash}, 'pending', now())
    ON CONFLICT ("txHash","logIndex") DO UPDATE SET
      "donor" = EXCLUDED."donor",
      "campaignId" = EXCLUDED."campaignId",
      "stablecoin" = EXCLUDED."stablecoin",
      "amountIn" = EXCLUDED."amountIn",
      "baseOut" = EXCLUDED."baseOut",
      "consentHash" = EXCLUDED."consentHash"
    WHERE "DonationLog"."status" = 'pending'
  `;
}

export interface ConfirmDonationInput {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  donor: string;
  campaignId: string;
  stablecoin: string;
  amountIn: string;
  baseOut: string;
  consentHash: string;
}

/**
 * Indexer confirm. Flips a matching pending row to confirmed, OR inserts directly
 * as confirmed when the donation was sent outside the web app. Idempotent: the
 * WHERE guard + COALESCE(confirmedAt) make a replay a true no-op.
 */
export function confirmDonation(db: Executor, i: ConfirmDonationInput): Promise<number> {
  return db.$executeRaw`
    INSERT INTO "DonationLog"
      ("id","txHash","logIndex","blockNumber","donor","campaignId","stablecoin","amountIn","baseOut","consentHash","status","createdAt","confirmedAt")
    VALUES
      (${randomUUID()}, ${i.txHash}, ${i.logIndex}, ${i.blockNumber}, ${i.donor}, ${i.campaignId}, ${i.stablecoin},
       ${i.amountIn}::numeric, ${i.baseOut}::numeric, ${i.consentHash}, 'confirmed', now(), now())
    ON CONFLICT ("txHash","logIndex") DO UPDATE SET
      "status" = 'confirmed',
      "blockNumber" = EXCLUDED."blockNumber",
      "donor" = EXCLUDED."donor",
      "campaignId" = EXCLUDED."campaignId",
      "stablecoin" = EXCLUDED."stablecoin",
      "amountIn" = EXCLUDED."amountIn",
      "baseOut" = EXCLUDED."baseOut",
      "consentHash" = EXCLUDED."consentHash",
      "confirmedAt" = COALESCE("DonationLog"."confirmedAt", now())
    WHERE "DonationLog"."status" <> 'confirmed'
  `;
}

// ------------------------------- Payouts -------------------------------------

export interface PendingPayoutInput {
  payoutId: string;
  campaignId: string;
  beneficiary: string;
  usdcAmount: string;
  rail?: string | null;
  feeBpsCovered?: number | null;
  rationale?: string | null;
  fallbackUsed?: boolean | null;
}

/** API optimistic payout write. Only fills a still-pending row (write-once COALESCE). */
export function upsertPendingPayout(db: Executor, i: PendingPayoutInput): Promise<number> {
  return db.$executeRaw`
    INSERT INTO "PayoutDecision"
      ("id","payoutId","campaignId","beneficiary","usdcAmount","rail","feeBpsCovered","rationale","fallbackUsed","status","createdAt","updatedAt")
    VALUES
      (${randomUUID()}, ${i.payoutId}, ${i.campaignId}, ${i.beneficiary}, ${i.usdcAmount}::numeric,
       ${i.rail ?? null}, ${i.feeBpsCovered ?? null}, ${i.rationale ?? null}, ${i.fallbackUsed ?? null}, 'pending', now(), now())
    ON CONFLICT ("payoutId") DO UPDATE SET
      "rail" = COALESCE("PayoutDecision"."rail", EXCLUDED."rail"),
      "feeBpsCovered" = COALESCE("PayoutDecision"."feeBpsCovered", EXCLUDED."feeBpsCovered"),
      "rationale" = COALESCE("PayoutDecision"."rationale", EXCLUDED."rationale"),
      "fallbackUsed" = COALESCE("PayoutDecision"."fallbackUsed", EXCLUDED."fallbackUsed"),
      "updatedAt" = now()
    WHERE "PayoutDecision"."status" = 'pending'
  `;
}

export interface TrancheReleasedInput {
  payoutId: string;
  campaignId: string;
  beneficiary: string;
  usdcAmount: string;
  unlockTime: bigint;
  releasedTxHash: string;
}

/** Indexer: TrancheReleased (CharityPool). Write-once facts; status advances unless terminal. */
export function applyTrancheReleased(db: Executor, i: TrancheReleasedInput): Promise<number> {
  return db.$executeRaw`
    INSERT INTO "PayoutDecision"
      ("id","payoutId","campaignId","beneficiary","usdcAmount","unlockTime","releasedTxHash","status","createdAt","updatedAt")
    VALUES
      (${randomUUID()}, ${i.payoutId}, ${i.campaignId}, ${i.beneficiary}, ${i.usdcAmount}::numeric,
       ${i.unlockTime}, ${i.releasedTxHash}, 'released', now(), now())
    ON CONFLICT ("payoutId") DO UPDATE SET
      "beneficiary" = COALESCE("PayoutDecision"."beneficiary", EXCLUDED."beneficiary"),
      "usdcAmount" = COALESCE("PayoutDecision"."usdcAmount", EXCLUDED."usdcAmount"),
      "unlockTime" = COALESCE("PayoutDecision"."unlockTime", EXCLUDED."unlockTime"),
      "releasedTxHash" = COALESCE("PayoutDecision"."releasedTxHash", EXCLUDED."releasedTxHash"),
      "status" = CASE
        WHEN "PayoutDecision"."routedTxHash" IS NOT NULL THEN 'routed'::"PayoutStatus"
        ELSE 'released'::"PayoutStatus"
      END,
      "updatedAt" = now()
    WHERE "PayoutDecision"."cancelledAt" IS NULL
  `;
}

export interface RoutedInput {
  payoutId: string;
  campaignId: string;
  beneficiary: string;
  usdcAmount: string;
  rail: string;
  feeBpsCovered: number;
  rationale: string;
  routedTxHash: string;
}

/** Indexer: Routed (PayoutRouter). Write-once facts; advances to routed unless cancelled. */
export function applyRouted(db: Executor, i: RoutedInput): Promise<number> {
  return db.$executeRaw`
    INSERT INTO "PayoutDecision"
      ("id","payoutId","campaignId","beneficiary","usdcAmount","rail","feeBpsCovered","rationale","routedTxHash","status","createdAt","updatedAt")
    VALUES
      (${randomUUID()}, ${i.payoutId}, ${i.campaignId}, ${i.beneficiary}, ${i.usdcAmount}::numeric,
       ${i.rail}, ${i.feeBpsCovered}, ${i.rationale}, ${i.routedTxHash}, 'routed', now(), now())
    ON CONFLICT ("payoutId") DO UPDATE SET
      "beneficiary" = COALESCE("PayoutDecision"."beneficiary", EXCLUDED."beneficiary"),
      "usdcAmount" = COALESCE("PayoutDecision"."usdcAmount", EXCLUDED."usdcAmount"),
      "rail" = COALESCE("PayoutDecision"."rail", EXCLUDED."rail"),
      "feeBpsCovered" = COALESCE("PayoutDecision"."feeBpsCovered", EXCLUDED."feeBpsCovered"),
      "rationale" = COALESCE("PayoutDecision"."rationale", EXCLUDED."rationale"),
      "routedTxHash" = COALESCE("PayoutDecision"."routedTxHash", EXCLUDED."routedTxHash"),
      "status" = 'routed'::"PayoutStatus",
      "updatedAt" = now()
    WHERE "PayoutDecision"."cancelledAt" IS NULL
  `;
}

/**
 * Indexer: PendingCancelled (PayoutRouter). UPDATE-only (the event carries no
 * beneficiary/amount, which are NOT NULL). Policy: a routed (disbursed) payout
 * cannot be cancelled. Idempotent via COALESCE(cancelledAt).
 */
export function applyPendingCancelled(db: Executor, payoutId: string): Promise<number> {
  return db.$executeRaw`
    UPDATE "PayoutDecision" SET
      "cancelledAt" = COALESCE("cancelledAt", now()),
      "status" = 'cancelled'::"PayoutStatus",
      "updatedAt" = now()
    WHERE "payoutId" = ${payoutId} AND "status" <> 'routed'
  `;
}

// ------------------------------- Campaign ------------------------------------

export interface CampaignChainStateInput {
  campaignId: string;
  releaseType: "PARAMETRIC" | "MILESTONE";
  /** Human slug used as a fallback `name`/`cause` for indexer-created stub rows. */
  stubLabel: string;
}

/**
 * Indexer: CampaignRegistered. Sets registeredOnChain, and fills descriptive
 * fields only when absent — so it never clobbers API-supplied metadata and never
 * touches the offchain-owned `active` flag. Idempotent.
 */
export function upsertCampaignChainState(db: Executor, i: CampaignChainStateInput): Promise<number> {
  return db.$executeRaw`
    INSERT INTO "Campaign"
      ("id","campaignId","type","cause","name","releaseType","registeredOnChain","active","createdAt","updatedAt")
    VALUES
      (${randomUUID()}, ${i.campaignId}, 'general', ${i.stubLabel}, ${i.stubLabel},
       ${i.releaseType}::"ReleaseType", true, false, now(), now())
    ON CONFLICT ("campaignId") DO UPDATE SET
      "registeredOnChain" = true,
      "releaseType" = COALESCE("Campaign"."releaseType", EXCLUDED."releaseType"),
      "updatedAt" = now()
  `;
}
