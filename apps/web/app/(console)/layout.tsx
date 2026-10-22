import type { ReactNode } from "react";
import { ConsoleProviders } from "@/lib/console/providers";

// The operator console mounts its own injected-wallet wagmi config here (separate
// route group), so neither Privy nor the console connector leak into the browse/donor
// bundles. QueryClient is provided inside ConsoleProviders (not the root one).
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleProviders>{children}</ConsoleProviders>;
}
