"use client";

import { useReadContracts } from "wagmi";
import type { Address, Hex } from "viem";
import { CharityPoolAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";

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
  owner: Address | undefined;
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
      { address: POOL, abi: CharityPoolAbi, functionName: "owner", chainId: CHAIN_ID },
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

  const [poolValue, totalSupply, halalMode, owner, releaseDelay] = poolRead.data ?? [];
  const [donated, released] = campaignRead.data ?? [];

  const accruedYield =
    poolValue !== undefined && totalSupply !== undefined
      ? poolValue > totalSupply
        ? poolValue - totalSupply
        : 0n
      : undefined;

  const remainingCap =
    donated !== undefined && released !== undefined ? donated - released : undefined;

  return {
    poolValue,
    totalSupply,
    halalMode,
    owner,
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
