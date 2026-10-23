"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";

// Gate for wallet-only flows (donate, mint). Connecting happens on ONE surface — /login — so
// an unauthenticated visitor is sent there with a `next` back-link rather than shown an inline
// connect widget. Children render only once a wallet is active. Replaces the old LoginGate.
export function RequireWallet({ children }: { children: ReactNode }) {
  const { state } = useDonorWallet();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, router, pathname]);

  if (state.status === "active") return <>{children}</>;

  const message =
    state.status === "unauthenticated" ? "Redirecting to sign in…" : "Loading wallet…";
  return (
    <p role="status" className="text-sm text-foreground-soft">
      {message}
    </p>
  );
}
