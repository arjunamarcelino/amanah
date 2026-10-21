import { z } from "zod";

/**
 * Shape of `EventIndex.payloadJson` (the raw decoded on-chain event mirror).
 * The indexer MUST stringify every uint256/bigint before storing — JSON numbers
 * are IEEE-754 doubles and lose precision above 2^53. Values are therefore
 * strings/numbers/booleans/null only; no nested bigints.
 */
export const EventIndexPayloadSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type EventIndexPayload = z.infer<typeof EventIndexPayloadSchema>;
