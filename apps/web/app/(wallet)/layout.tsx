import type { ReactNode } from "react";
import { WalletProviders } from "@/lib/wallet-providers";
import { WalletBar } from "@/components/WalletBar";

// Wallet routes (/mint, /donate/[campaignId]) mount Dynamic + wagmi here, so the
// wallet SDK stays out of the browse route's bundle. WalletBar (inside the providers)
// surfaces the connected address + a disconnect control once a wallet is active.
export default function WalletLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProviders>
      <WalletBar />
      {children}
    </WalletProviders>
  );
}
