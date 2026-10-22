"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useBalance } from "wagmi";
import { getAddress, type Address } from "viem";
import { CHAIN_ID } from "@amanah/shared";
import { caipToChainId } from "@/lib/caip";

// Discriminated state for the embedded-wallet lifecycle. `address` exists ONLY on
// the "active" arm, so consumers physically cannot read it while provisioning.
export type DonorWalletState =
  | { status: "initializing" } // Privy SDK not ready
  | { status: "unauthenticated" } // ready, not logged in
  | { status: "provisioning" } // authenticated, embedded wallet not yet created
  | {
      status: "active";
      address: Address;
      chainId: number | undefined;
      isBaseSepolia: boolean;
      nativeBalance: bigint;
      needsGas: boolean;
    };

export function useDonorWallet(): {
  state: DonorWalletState;
  login: () => void;
  logout: () => Promise<void>;
  refetchBalance: () => void;
} {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // The donor is specifically the Privy EMBEDDED wallet (not any connected external one).
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const address = embedded ? getAddress(embedded.address) : undefined;

  const { data: balance, refetch } = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  let state: DonorWalletState;
  if (!ready) {
    state = { status: "initializing" };
  } else if (!authenticated) {
    state = { status: "unauthenticated" };
  } else if (!address) {
    state = { status: "provisioning" };
  } else {
    const chainId = caipToChainId(embedded?.chainId);
    const nativeBalance = balance?.value ?? 0n;
    state = {
      status: "active",
      address,
      chainId,
      isBaseSepolia: chainId === CHAIN_ID,
      nativeBalance,
      needsGas: nativeBalance === 0n,
    };
  }

  return {
    state,
    login,
    logout,
    refetchBalance: () => {
      void refetch();
    },
  };
}
