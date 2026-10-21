import type { Prisma } from "@amanah/db";
import {
  applyPendingCancelled,
  applyRouted,
  applyTrancheReleased,
  confirmDonation,
  upsertCampaignChainState,
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

/** Typed projections. C17a handles Donated; C17b extends this with payouts/campaign/lifecycle. */
async function projectTypedRow(tx: Prisma.TransactionClient, log: IndexerLog): Promise<void> {
  const args = (log.args ?? {}) as Record<string, unknown>;
  switch (log.eventName) {
    case "Donated":
      await confirmDonation(tx, {
        txHash: normalizeHex(String(log.transactionHash)),
        logIndex: log.logIndex ?? 0,
        blockNumber: log.blockNumber ?? 0n,
        donor: normalizeHex(String(args.donor)),
        campaignId: normalizeHex(String(args.campaignId)),
        stablecoin: normalizeHex(String(args.stablecoin)),
        amountIn: String(args.amountIn),
        baseOut: String(args.baseOut),
        consentHash: normalizeHex(String(args.consentHash)),
      });
      break;

    case "TrancheReleased":
      await applyTrancheReleased(tx, {
        payoutId: normalizeHex(String(args.payoutId)),
        campaignId: normalizeHex(String(args.campaignId)),
        beneficiary: normalizeHex(String(args.beneficiary)),
        usdcAmount: String(args.usdcAmount),
        unlockTime: args.unlockTime as bigint,
        releasedTxHash: normalizeHex(String(log.transactionHash)),
      });
      break;

    case "Routed":
      await applyRouted(tx, {
        payoutId: normalizeHex(String(args.payoutId)),
        campaignId: normalizeHex(String(args.campaignId)),
        beneficiary: normalizeHex(String(args.beneficiary)),
        usdcAmount: String(args.usdcAmount),
        rail: String(args.rail),
        feeBpsCovered: Number(args.feeBpsCovered),
        rationale: String(args.rationale),
        routedTxHash: normalizeHex(String(log.transactionHash)),
      });
      break;

    case "PendingCancelled":
      await applyPendingCancelled(tx, normalizeHex(String(args.payoutId)));
      break;

    case "CampaignRegistered":
      await upsertCampaignChainState(tx, {
        campaignId: normalizeHex(String(args.campaignId)),
        releaseType: releaseTypeFromOrdinal(Number(args.releaseType)),
        stubLabel: `on-chain ${String(args.campaignId).slice(0, 10)}`,
      });
      break;

    default:
      // Lifecycle (TriggerFired/MilestoneApproved/TriggerRevoked), config and
      // PendingSet events are captured in EventIndex only — no typed projection.
      break;
  }
}
