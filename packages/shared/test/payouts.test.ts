import { describe, it, expect } from "vitest";
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { CharityPoolAbi, parseTrancheReleasedEvent } from "../src/index.js";

const pool = ("0x" + "9".repeat(40)) as Address;
const beneficiary = ("0x" + "1".repeat(40)) as Address;
const payoutId = ("0x" + "a".repeat(64)) as Hex;
const campaignId = ("0x" + "b".repeat(64)) as Hex;
const otherCampaign = ("0x" + "c".repeat(64)) as Hex;

function releasedLog(
  usdcAmount: bigint,
  unlockTime: bigint,
  opts: { address?: Address; logIndex?: number; campaign?: Hex } = {},
) {
  const topics = encodeEventTopics({
    abi: CharityPoolAbi,
    eventName: "TrancheReleased",
    args: { payoutId, campaignId: opts.campaign ?? campaignId, beneficiary },
  });
  const data = encodeAbiParameters(
    parseAbiParameters("uint256 usdcAmount, uint256 unlockTime"),
    [usdcAmount, unlockTime],
  );
  return { address: opts.address ?? pool, topics, data, logIndex: opts.logIndex ?? 3 };
}

function receipt(logs: ReturnType<typeof releasedLog>[], status: "success" | "reverted" = "success") {
  return { status, logs } as unknown as TransactionReceipt;
}

describe("parseTrancheReleasedEvent", () => {
  it("decodes payoutId, beneficiary and the actual usdcAmount", () => {
    const r = receipt([releasedLog(1_500_000n, 42n)]);
    const ev = parseTrancheReleasedEvent(r, pool);
    expect(ev).toEqual({
      payoutId,
      campaignId,
      beneficiary,
      usdcAmount: 1_500_000n,
      unlockTime: 42n,
      logIndex: 3,
    });
  });

  it("returns null on a reverted receipt", () => {
    expect(parseTrancheReleasedEvent(receipt([releasedLog(1n, 0n)], "reverted"), pool)).toBeNull();
  });

  it("returns null when no TrancheReleased log is present", () => {
    expect(parseTrancheReleasedEvent(receipt([]), pool)).toBeNull();
  });

  it("ignores logs not emitted by the pool address", () => {
    const foreign = ("0x" + "7".repeat(40)) as Address;
    const r = receipt([releasedLog(5n, 0n, { address: foreign })]);
    expect(parseTrancheReleasedEvent(r, pool)).toBeNull();
  });

  it("filters to the expected campaignId when several releases share a receipt", () => {
    const r = receipt([
      releasedLog(10n, 1n, { campaign: otherCampaign, logIndex: 2 }),
      releasedLog(20n, 2n, { campaign: campaignId, logIndex: 4 }),
    ]);
    const ev = parseTrancheReleasedEvent(r, pool, { campaignId });
    expect(ev?.usdcAmount).toBe(20n);
    expect(ev?.logIndex).toBe(4);
  });
});
