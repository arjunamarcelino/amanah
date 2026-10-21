import type { Prisma } from "@amanah/db";
import { prisma } from "./db.js";
import { config } from "./config.js";

/** First block to process. Empty cursor => the deploy block (never block 0). */
export async function getCursorStart(): Promise<bigint> {
  const row = await prisma.indexerCursor.findUnique({ where: { name: config.cursorName } });
  return row ? row.lastBlock + 1n : config.startBlock;
}

/**
 * Advance the cursor to `toBlock` within the caller's transaction (same tx as the
 * event rows), so the cursor can never outrun persisted data. Called every chunk,
 * including zero-event ranges, so the backfill always progresses to head.
 */
export async function commitCursor(tx: Prisma.TransactionClient, toBlock: bigint): Promise<void> {
  await tx.indexerCursor.upsert({
    where: { name: config.cursorName },
    create: { name: config.cursorName, lastBlock: toBlock },
    update: { lastBlock: toBlock },
  });
}
