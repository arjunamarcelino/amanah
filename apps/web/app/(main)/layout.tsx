import type { ReactNode } from "react";
import { WalletProviders } from "@/lib/wallet-providers";
import { SearchProvider } from "@/lib/search";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Shell for the donor-facing app: Discover, Ledger, Login, Mint, Donate. Per the "live wallet
// everywhere" decision the Dynamic + wagmi providers mount here (not per-route), so the shared
// SiteHeader can show the connected address on every page — including Discover. The operator
// console stays in its own route group with its own injected-wallet config; it never mounts
// this shell. QueryClient is still provided once at the root, above this group.
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <WalletProviders>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </WalletProviders>
    </SearchProvider>
  );
}
