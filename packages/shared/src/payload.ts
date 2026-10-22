import { z } from "zod";
import type { Address, Hex } from "viem";
import { CreateDonationSchema, type CreateDonation } from "./schemas.js";

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

/**
 * Build the strict `POST /donations` body from on-chain truth. Amounts are the
 * exact base-unit bigints from the tx / the parsed `Donated` event; they are
 * stringified at THIS single boundary to satisfy `DecimalStringSchema` (string
 * end-to-end keeps 78-digit precision). `.parse` fails fast on a malformed
 * payload and returns the validated, typed value — the one source of truth for
 * the request shape (never hand-duplicate the fields). Co-located with the
 * schema so the client, api and indexer can't drift on the convention.
 */
export function buildDonationPayload(input: {
  txHash: Hex;
  logIndex: number;
  donor: Address;
  campaignId: Hex;
  stablecoin: Address;
  amountIn: bigint;
  baseOut: bigint;
  consentHash: Hex;
}): CreateDonation {
  return CreateDonationSchema.parse({
    txHash: input.txHash,
    logIndex: input.logIndex,
    donor: input.donor,
    campaignId: input.campaignId,
    stablecoin: input.stablecoin,
    amountIn: input.amountIn.toString(),
    baseOut: input.baseOut.toString(),
    consentHash: input.consentHash,
  });
}
