import type { ReactNode } from "react";
import { WalletProviders } from "@/lib/wallet-providers";

// Standalone auth shell: mounts the wallet providers (so /login can render Dynamic's connect
// widget) but NO SiteHeader/SiteFooter — the sign-in page is intentionally chrome-free. The
// root QueryProvider still wraps this group (wagmi's queries need it).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
