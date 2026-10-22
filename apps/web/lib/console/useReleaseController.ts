"use client";

import { useReadContracts } from "wagmi";
import type { Hex } from "viem";
import {
  ReleaseControllerAbi,
  ADDRESSES,
  CHAIN_ID,
  releaseTypeFromOrdinal,
  type ReleaseType,
} from "@amanah/shared";

const CONTROLLER = ADDRESSES[CHAIN_ID].ReleaseController;

export type ReleaseControllerReads = {
  registered: boolean | undefined;
  /** undefined until registered (or while loading). */
  releaseType: ReleaseType | undefined;
  canRelease: boolean | undefined;
  activatedAt: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};

export function useReleaseController(
  campaignId?: Hex,
  opts?: { refetchIntervalMs?: number },
): ReleaseControllerReads {
  const read = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: CONTROLLER,
        abi: ReleaseControllerAbi,
        functionName: "campaignInfo",
        args: [campaignId ?? "0x"],
        chainId: CHAIN_ID,
      },
      {
        address: CONTROLLER,
        abi: ReleaseControllerAbi,
        functionName: "canRelease",
        args: [campaignId ?? "0x"],
        chainId: CHAIN_ID,
      },
      {
        address: CONTROLLER,
        abi: ReleaseControllerAbi,
        functionName: "activatedAt",
        args: [campaignId ?? "0x"],
        chainId: CHAIN_ID,
      },
    ],
    query: { enabled: Boolean(campaignId), refetchInterval: opts?.refetchIntervalMs },
  });

  // campaignInfo is a multi-output read → viem infers readonly [boolean, number].
  // Destructure the tuple; never object-access.
  const info = read.data?.[0];
  const canRelease = read.data?.[1];
  const activatedAt = read.data?.[2];

  const registered = info?.[0];
  const releaseType = registered ? releaseTypeFromOrdinal(info![1]) : undefined;

  return {
    registered,
    releaseType,
    canRelease,
    activatedAt,
    isLoading: Boolean(campaignId) && read.isLoading,
    isError: read.isError,
    refetch: async () => {
      await read.refetch();
    },
  };
}
