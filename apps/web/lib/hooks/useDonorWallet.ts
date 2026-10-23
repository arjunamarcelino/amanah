"use client";

import { useCallback } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { useAccount, useBalance } from "wagmi";
import type { Address } from "viem";
import { CHAIN_ID } from "@amanah/shared";

// Discriminated state for the donor wallet lifecycle. `address` exists ONLY on the "active"
// arm, so consumers physically cannot read it while provisioning.
export type DonorWalletState =
  | { status: "initializing" } // Dynamic SDK not loaded yet
  | { status: "unauthenticated" } // loaded, no active wallet (not logged in and none connected)
  | { status: "provisioning" } // logged in / connected, wallet not yet bridged into wagmi
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
  logout: () => Promise<void>;
  refetchBalance: () => void;
} {
  // login is intentionally NOT exposed: the logged-out arm uses Dynamic's <DynamicWidget/>.
  const { sdkHasLoaded, handleLogOut } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  // DynamicWagmiConnector bridges the active wallet (embedded OR external) into wagmi, so the
  // active address/chain come straight from wagmi — this is what covers external wallets too.
  const { address, chainId, isConnected } = useAccount();

  const { data: balance, refetch } = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  let state: DonorWalletState;
  if (!sdkHasLoaded) {
    state = { status: "initializing" };
  } else if (!isLoggedIn && !isConnected) {
    state = { status: "unauthenticated" };
  } else if (!address) {
    state = { status: "provisioning" };
  } else {
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

  // Stable identities (the hook advertises these as a public API that may land in deps).
  const logout = useCallback(() => handleLogOut(), [handleLogOut]);
  const refetchBalance = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { state, logout, refetchBalance };
}
