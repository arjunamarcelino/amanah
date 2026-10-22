"use client";

import { useReadContract } from "wagmi";
import { MockStablecoinAbi, ADDRESSES, CHAIN_ID } from "@amanah/shared";
import type { Address } from "viem";

const POOL = ADDRESSES[CHAIN_ID].CharityPool;

/** balanceOf + allowance(owner -> CharityPool) for a stablecoin, chain-pinned,
 * with a combined refetch (call after mint/approve/donate or on token switch). */
export function useErc20(token: Address | undefined, owner: Address | undefined) {
  const enabled = Boolean(token && owner);

  const balance = useReadContract({
    address: token,
    abi: MockStablecoinAbi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    chainId: CHAIN_ID,
    query: { enabled },
  });

  const allowance = useReadContract({
    address: token,
    abi: MockStablecoinAbi,
    functionName: "allowance",
    args: owner ? [owner, POOL] : undefined,
    chainId: CHAIN_ID,
    query: { enabled },
  });

  return {
    balance: balance.data as bigint | undefined,
    allowance: allowance.data as bigint | undefined,
    async refetch() {
      await Promise.all([balance.refetch(), allowance.refetch()]);
    },
  };
}
