"use client";

import { useReadContracts } from "wagmi";
import type { Hex } from "viem";
import { CharityPoolAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import { clampedYield } from "../yield";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

// Console-config only: reads resolve against whichever WagmiProvider renders this,
// which in the (console) group is the injected-owner config. Do NOT mount under the
// Privy (wallet) tree.
//
// Two multicall-batched reads (not ~9 separate eth_calls): pool-wide values (always)
// and the per-campaign totals (when a campaign is selected). viem's baseSepolia carries
// Multicall3, and the console transport sets batch:{multicall:true}.

export type CharityPoolReads = {
  poolValue: bigint | undefined;
  totalSupply: bigint | undefined;
  halalMode: boolean | undefined;
  releaseDelay: bigint | undefined;
  donated: bigint | undefined;
  released: bigint | undefined;
  /** poolValue − totalSupply, clamped at 0 (never negative, e.g. mid-rebalance). */
  accruedYield: bigint | undefined;
  /** donated − released (0 when either is missing). */
  remainingCap: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};

export function useCharityPool(
  campaignId?: Hex,
  opts?: { refetchIntervalMs?: number },
): CharityPoolReads {
  const poolRead = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: POOL, abi: CharityPoolAbi, functionName: "poolValue", chainId: CHAIN_ID },
      { address: POOL, abi: CharityPoolAbi, functionName: "totalSupply", chainId: CHAIN_ID },
      { address: POOL, abi: CharityPoolAbi, functionName: "halalMode", chainId: CHAIN_ID },
      { address: POOL, abi: CharityPoolAbi, functionName: "releaseDelay", chainId: CHAIN_ID },
    ],
    query: { refetchInterval: opts?.refetchIntervalMs },
  });

  const campaignRead = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: POOL,
        abi: CharityPoolAbi,
        functionName: "donatedByCampaign",
        args: [campaignId ?? "0x"],
        chainId: CHAIN_ID,
      },
      {
        address: POOL,
        abi: CharityPoolAbi,
        functionName: "releasedByCampaign",
        args: [campaignId ?? "0x"],
        chainId: CHAIN_ID,
      },
    ],
    query: { enabled: Boolean(campaignId), refetchInterval: opts?.refetchIntervalMs },
  });

  // Use `?.[i]` (not `?? []`): the `?? []` fallback erases the `| undefined` from each
  // element's type, defeating the null guards below.
  const poolData = poolRead.data;
  const poolValue = poolData?.[0];
  const totalSupply = poolData?.[1];
  const halalMode = poolData?.[2];
  const releaseDelay = poolData?.[3];
  const campaignData = campaignRead.data;
  const donated = campaignData?.[0];
  const released = campaignData?.[1];

  const accruedYield =
    poolValue !== undefined && totalSupply !== undefined
      ? clampedYield(poolValue, totalSupply)
      : undefined;

  const remainingCap =
    donated !== undefined && released !== undefined ? donated - released : undefined;

  return {
    poolValue,
    totalSupply,
    halalMode,
    releaseDelay,
    donated,
    released,
    accruedYield,
    remainingCap,
    isLoading: poolRead.isLoading || (Boolean(campaignId) && campaignRead.isLoading),
    isError: poolRead.isError || campaignRead.isError,
    refetch: async () => {
      await Promise.all([poolRead.refetch(), campaignRead.refetch()]);
    },
  };
}
