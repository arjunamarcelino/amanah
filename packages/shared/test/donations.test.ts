import { describe, it, expect } from "vitest";
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { CharityPoolAbi, parseDonatedEvent } from "../src/index.js";

const pool = ("0x" + "9".repeat(40)) as Address;
const donor = ("0x" + "1".repeat(40)) as Address;
const stablecoin = ("0x" + "2".repeat(40)) as Address;
const campaignId = ("0x" + "b".repeat(64)) as Hex;
const consentHash = ("0x" + "c".repeat(64)) as Hex;

function donatedLog(amountIn: bigint, baseOut: bigint, address: Address = pool, logIndex = 2) {
  const topics = encodeEventTopics({
    abi: CharityPoolAbi,
    eventName: "Donated",
    args: { donor, campaignId, stablecoin },
  });
  const data = encodeAbiParameters(
    parseAbiParameters("uint256 amountIn, uint256 baseOut, bytes32 consentHash"),
    [amountIn, baseOut, consentHash],
  );
  return { address, topics, data, logIndex };
}

function receipt(logs: unknown[], status: "success" | "reverted" = "success"): TransactionReceipt {
  return { status, logs } as unknown as TransactionReceipt;
}

describe("parseDonatedEvent", () => {
  it("decodes baseOut + the real logIndex", () => {
    expect(parseDonatedEvent(receipt([donatedLog(1_000000n, 999999n)]), pool)).toEqual({
      baseOut: 999999n,
      logIndex: 2,
    });
  });

  it("returns null when the tx reverted", () => {
    expect(parseDonatedEvent(receipt([donatedLog(1n, 1n)], "reverted"), pool)).toBeNull();
  });

  it("ignores logs from other contracts (does not trust index 0)", () => {
    const foreign = donatedLog(1n, 1n, ("0x" + "e".repeat(40)) as Address, 0);
    const real = donatedLog(5n, 4n, pool, 1);
    expect(parseDonatedEvent(receipt([foreign, real]), pool)).toEqual({ baseOut: 4n, logIndex: 1 });
  });

  it("returns null when decoded fields mismatch the submitted args", () => {
    const r = receipt([donatedLog(1_000000n, 999999n)]);
    expect(parseDonatedEvent(r, pool, { campaignId, stablecoin, donor, amount: 500n })).toBeNull();
    expect(parseDonatedEvent(r, pool, { campaignId, stablecoin, donor, amount: 1_000000n })).toEqual({
      baseOut: 999999n,
      logIndex: 2,
    });
  });

  it("returns null when no Donated log is present", () => {
    expect(parseDonatedEvent(receipt([]), pool)).toBeNull();
  });
});
