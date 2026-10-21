import { config } from "./config.js";
import { publicClient } from "./client.js";
import { prisma } from "./db.js";
import { getCursorStart } from "./cursor.js";
import { backfill } from "./backfill.js";
import { handleChunk } from "./handlers.js";
import { WATCHED_ADDRESSES } from "./contracts.js";

let shuttingDown = false;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log(
    `[indexer] chain=${config.chainId} rpc=${config.rpcUrl} watching ${WATCHED_ADDRESSES.length} contracts`,
  );

  // Resume from the cursor (or the deploy block). The same chunked backfill drives
  // both the historical catch-up and each live tail step.
  let from = await getCursorStart();
  let backoffMs = 1_000;

  while (!shuttingDown) {
    try {
      const head = await publicClient.getBlockNumber();
      // reorg bound, clamped so a very fresh chain can't underflow to a negative bigint
      const safeHead = head > config.confirmations ? head - config.confirmations : 0n;
      if (safeHead >= from) {
        await backfill(from, safeHead, handleChunk);
        from = safeHead + 1n;
      }
      backoffMs = 1_000; // reset after a clean poll
    } catch (err) {
      console.error(`[indexer] poll error: ${err instanceof Error ? err.message : String(err)}`);
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000); // exponential backoff; cursor not advanced
      continue;
    }
    await sleep(config.pollMs);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  console.log(`[indexer] ${signal} received — shutting down`);
  shuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
