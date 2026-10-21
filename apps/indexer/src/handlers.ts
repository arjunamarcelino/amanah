import type { Prisma } from "@amanah/db";
import {
  applyPendingCancelled,
  applyRouted,
  applyTrancheReleased,
  confirmDonation,
  upsertCampaignChainState,
  upsertPendingPayout,
} from "@amanah/db";
import { normalizeHex, releaseTypeFromOrdinal } from "@amanah/shared";
import { prisma } from "./db.js";
import { commitCursor } from "./cursor.js";
import { isWatchedAddress } from "./contracts.js";
import { eventIndexRow } from "./serialize.js";
import type { IndexerLog } from "./backfill.js";

/**
 * Process one backfill chunk atomically: write EVERY event to EventIndex (the raw
 * audit log, idempotent via @@unique(txHash,logIndex)), project the typed rows,
 * and advance the cursor — all in one transaction, so a crash/replay of the range
 * is a no-op. Called for every chunk, including empty ones.
 */
export function handleChunk(logs: IndexerLog[], toBlock: bigint): Promise<void> {
  const watched = logs.filter((l) => isWatchedAddress(l.address));
  return prisma.$transaction(
    async (tx) => {
      if (watched.length > 0) {
        await tx.eventIndex.createMany({ data: watched.map(eventIndexRow), skipDuplicates: true });
      }
      for (const log of watched) {
        await projectTypedRow(tx, log);
      }
      await commitCursor(tx, toBlock);
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

// Validating extractors — a missing/renamed arg (ABI drift, event-name collision,
// a non-strict log) throws loudly here, so the chunk tx rolls back and the backfill
// shrinks to a single block and surfaces it, rather than persisting NaN/"undefined".
function argStr(args: Record<string, unknown>, k: string): string {
  const v = args[k];
  if (typeof v !== "string") throw new Error(`event arg "${k}" missing or not a string`);
  return v;
}
function argHex(args: Record<string, unknown>, k: string): string {
  return normalizeHex(argStr(args, k));
}
function argBig(args: Record<string, unknown>, k: string): bigint {
  const v = args[k];
  if (typeof v !== "bigint") throw new Error(`event arg "${k}" missing or not a bigint`);
  return v;
}
function argUint(args: Record<string, unknown>, k: string): number {
  const v = args[k];
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  throw new Error(`event arg "${k}" missing or not numeric`);
}
function txHashOf(log: IndexerLog): string {
  if (typeof log.transactionHash !== "string") throw new Error("log missing transactionHash");
  return normalizeHex(log.transactionHash);
}
function blockOf(log: IndexerLog): bigint {
  if (typeof log.blockNumber !== "bigint") throw new Error("log missing blockNumber");
  return log.blockNumber;
}
function logIndexOf(log: IndexerLog): number {
  if (typeof log.logIndex !== "number") throw new Error("log missing logIndex");
  return log.logIndex;
}

/** Typed projections. Each coercion is validated (see extractors above). */
async function projectTypedRow(tx: Prisma.TransactionClient, log: IndexerLog): Promise<void> {
  const args = (log.args ?? {}) as Record<string, unknown>;
  switch (log.eventName) {
    case "Donated":
      await confirmDonation(tx, {
        txHash: txHashOf(log),
        logIndex: logIndexOf(log),
        blockNumber: blockOf(log),
        donor: argHex(args, "donor"),
        campaignId: argHex(args, "campaignId"),
        stablecoin: argHex(args, "stablecoin"),
        amountIn: argBig(args, "amountIn").toString(),
        baseOut: argBig(args, "baseOut").toString(),
        consentHash: argHex(args, "consentHash"),
      });
      break;

    case "TrancheReleased":
      await applyTrancheReleased(tx, {
        payoutId: argHex(args, "payoutId"),
        campaignId: argHex(args, "campaignId"),
        beneficiary: argHex(args, "beneficiary"),
        usdcAmount: argBig(args, "usdcAmount").toString(),
        unlockTime: argBig(args, "unlockTime"),
        releasedTxHash: txHashOf(log),
      });
      break;

    case "Routed":
      await applyRouted(tx, {
        payoutId: argHex(args, "payoutId"),
        campaignId: argHex(args, "campaignId"),
        beneficiary: argHex(args, "beneficiary"),
        usdcAmount: argBig(args, "usdcAmount").toString(),
        rail: argStr(args, "rail"),
        feeBpsCovered: argUint(args, "feeBpsCovered"),
        rationale: argStr(args, "rationale"),
        routedTxHash: txHashOf(log),
      });
      break;

    case "PendingSet":
      // Create a pending payout row so a later PendingCancelled (which carries no
      // beneficiary/amount) always has a row to transition. No-op if the row is
      // already released/routed (upsertPendingPayout only fills a pending row).
      await upsertPendingPayout(tx, {
        payoutId: argHex(args, "payoutId"),
        campaignId: argHex(args, "campaignId"),
        beneficiary: argHex(args, "beneficiary"),
        usdcAmount: argBig(args, "amount").toString(),
      });
      break;

    case "PendingCancelled":
      await applyPendingCancelled(tx, argHex(args, "payoutId"));
      break;

    case "CampaignRegistered":
      await upsertCampaignChainState(tx, {
        campaignId: argHex(args, "campaignId"),
        releaseType: releaseTypeFromOrdinal(argUint(args, "releaseType")),
        stubLabel: `on-chain ${argHex(args, "campaignId").slice(0, 10)}`,
      });
      break;

    default:
      // Lifecycle (TriggerFired/MilestoneApproved/TriggerRevoked) and config
      // events are captured in EventIndex only — no typed projection.
      break;
  }
}
