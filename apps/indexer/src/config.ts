import "dotenv/config";
import { CHAIN_ID, START_BLOCK } from "@amanah/shared";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

export const config = {
  chainId: CHAIN_ID,
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
  databaseUrl: required("DATABASE_URL"),
  /** Backfill start (deploy block from @amanah/shared), overridable for tests/replays. */
  startBlock: BigInt(process.env.INDEXER_START_BLOCK ?? String(START_BLOCK)),
  /** Index only up to head − confirmations (OP-Stack L2 reorg bound). */
  confirmations: BigInt(process.env.INDEXER_CONFIRMATIONS ?? "15"),
  /** Live-poll interval (Base ~2s blocks). */
  pollMs: Number(process.env.INDEXER_POLL_MS ?? "4000"),
  /** Initial backfill chunk size (halves on RPC range/result caps). */
  initialChunk: BigInt(process.env.INDEXER_CHUNK ?? "10000"),
  cursorName: "base-sepolia",
} as const;
