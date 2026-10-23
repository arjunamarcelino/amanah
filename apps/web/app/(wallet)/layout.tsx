import type { ReactNode } from "react";
import { WalletProviders } from "@/lib/wallet-providers";

// Wallet routes (/mint, /donate/[campaignId]) mount Dynamic + wagmi here, so the
// wallet SDK stays out of the browse route's bundle.
export default function WalletLayout({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
