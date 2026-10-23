import type { ReactNode } from "react";
import { SearchProvider } from "@/lib/search";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Shell for the donor-facing app: Discover, Ledger, Detail, Mint, Donate. The wallet SDK
// (Dynamic + wagmi) is NOT mounted here — it would then ship on the high-traffic, wallet-free
// browse/ledger pages. Only the routes that actually use the wallet (mint, donate) wrap their
// own content in WalletProviders; the shared SiteHeader shows a plain "Sign in" link. The
// operator console stays in its own route group. QueryClient is provided once at the root.
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SearchProvider>
  );
}
