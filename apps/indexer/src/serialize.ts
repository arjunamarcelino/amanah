import type { Prisma } from "@amanah/db";
import { EventIndexPayloadSchema, normalizeHex, type EventIndexPayload } from "@amanah/shared";
import type { IndexerLog } from "./backfill.js";

// Pure, config/db-free so it's unit-testable without a DATABASE_URL.

/** uint256/bigint -> string (JSON numbers lose precision above 2^53). */
export function serializeArgs(args: Record<string, unknown>): EventIndexPayload {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "bigint") out[k] = v.toString();
    else if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      // Arrays/tuples/structs (e.g. decoded struct args) -> JSON, preserving nested
      // bigints as strings, rather than a lossy String() => "[object Object]".
      out[k] = JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val));
    }
  }
  return EventIndexPayloadSchema.parse(out);
}

export function eventIndexRow(log: IndexerLog) {
  const args = (log.args ?? {}) as Record<string, unknown>;
  const campaignId = typeof args.campaignId === "string" ? normalizeHex(args.campaignId) : null;
  return {
    eventName: log.eventName ?? "Unknown",
    blockNumber: log.blockNumber ?? 0n,
    txHash: normalizeHex(log.transactionHash ?? "0x"),
    logIndex: log.logIndex ?? 0,
    campaignId,
    payloadJson: serializeArgs(args) as Prisma.InputJsonValue,
  };
}
